import { Injectable, Logger } from '@nestjs/common';

/**
 * Episode data from Trakt API.
 */
interface EpisodeData {
  number: number;
  title: string;
  rating: number;
  votes: number;
}

/**
 * Season data with episodes.
 */
interface SeasonData {
  number: number;
  episodes: EpisodeData[];
}

/**
 * Drop-off analysis result stored in JSONB.
 */
export interface DropOffAnalysis {
  dropOffPoint: { season: number; episode: number; title: string } | null;
  dropOffPercent: number;
  overallRetention: number;
  seasonEngagement: Array<{
    season: number;
    avgRating: number;
    avgVotes: number;
    engagementDrop: number;
  }>;
  insight: string;
  insightType: 'strong_start' | 'steady' | 'drops_early' | 'drops_late';
  analyzedAt: string;
  episodesAnalyzed: number;
}

/**
 * Configuration for drop-off detection.
 */
const DROP_OFF_CONFIG = {
  // Minimum rating drop to consider as drop-off point
  minRatingDrop: 1.0,
  // Minimum votes drop percentage to consider as drop-off
  minVotesDropPercent: 40,
  // Minimum votes to consider episode as valid data point
  minVotesThreshold: 100,
  // Early drop = within first 30% of episodes
  earlyDropThreshold: 0.3,
};

/**
 * Service for analyzing show episode data to detect viewer drop-off points.
 * 
 * Drop-off is detected when:
 * - Rating drops by >= 1.0 points AND
 * - Votes drop by >= 40%
 */
@Injectable()
export class DropOffAnalyzerService {
  private readonly logger = new Logger(DropOffAnalyzerService.name);

  /**
   * Analyzes show episodes to detect drop-off points and generate insights.
   */
  analyze(seasons: SeasonData[]): DropOffAnalysis {
    if (!seasons.length) {
      return this.emptyAnalysis();
    }

    // Flatten all episodes with season info
    const allEpisodes = this.flattenEpisodes(seasons);
    
    if (allEpisodes.length < 3) {
      return this.emptyAnalysis();
    }

    // Calculate season engagement
    const seasonEngagement = this.calculateSeasonEngagement(seasons);
    
    // Find drop-off point
    const dropOffPoint = this.findDropOffPoint(allEpisodes);
    
    // Calculate overall retention based on season engagement (first vs last season avg votes)
    const firstSeasonVotes = seasonEngagement[0]?.avgVotes || 1;
    const lastSeasonVotes = seasonEngagement[seasonEngagement.length - 1]?.avgVotes || 0;
    const overallRetention = Math.round((lastSeasonVotes / firstSeasonVotes) * 100);
    
    const dropOffPercent = dropOffPoint 
      ? this.calculateDropOffPercent(allEpisodes, dropOffPoint)
      : 0;

    // Generate insight
    const { insight, insightType } = this.generateInsight(
      dropOffPoint,
      dropOffPercent,
      overallRetention,
      allEpisodes.length
    );

    return {
      dropOffPoint,
      dropOffPercent,
      overallRetention: Math.max(0, Math.min(100, overallRetention)),
      seasonEngagement,
      insight,
      insightType,
      analyzedAt: new Date().toISOString(),
      episodesAnalyzed: allEpisodes.length,
    };
  }

  /**
   * Flattens seasons into a single episode array with season info.
   */
  private flattenEpisodes(seasons: SeasonData[]): Array<EpisodeData & { season: number }> {
    return seasons.flatMap(s => 
      s.episodes.map(ep => ({ ...ep, season: s.number }))
    );
  }

  /**
   * Calculates engagement metrics per season.
   */
  private calculateSeasonEngagement(seasons: SeasonData[]): DropOffAnalysis['seasonEngagement'] {
    let prevAvgVotes = 0;
    
    return seasons.map((season, index) => {
      const validEpisodes = season.episodes.filter(
        ep => ep.votes >= DROP_OFF_CONFIG.minVotesThreshold
      );
      
      const avgRating = validEpisodes.length
        ? validEpisodes.reduce((sum, ep) => sum + ep.rating, 0) / validEpisodes.length
        : 0;
      
      const avgVotes = validEpisodes.length
        ? Math.round(validEpisodes.reduce((sum, ep) => sum + ep.votes, 0) / validEpisodes.length)
        : 0;
      
      const engagementDrop = index === 0 || prevAvgVotes === 0
        ? 0
        : Math.round(((prevAvgVotes - avgVotes) / prevAvgVotes) * 100);
      
      prevAvgVotes = avgVotes;
      
      return {
        season: season.number,
        avgRating: Math.round(avgRating * 10) / 10,
        avgVotes,
        engagementDrop: Math.max(0, engagementDrop),
      };
    });
  }

  /**
   * Finds the first significant drop-off point in the series.
   */
  private findDropOffPoint(
    episodes: Array<EpisodeData & { season: number }>
  ): DropOffAnalysis['dropOffPoint'] {
    // Need at least 2 episodes with valid votes
    const validEpisodes = episodes.filter(
      ep => ep.votes >= DROP_OFF_CONFIG.minVotesThreshold
    );
    
    if (validEpisodes.length < 2) return null;

    for (let i = 1; i < validEpisodes.length; i++) {
      const prev = validEpisodes[i - 1];
      const curr = validEpisodes[i];
      
      const ratingDrop = prev.rating - curr.rating;
      const votesDropPercent = ((prev.votes - curr.votes) / prev.votes) * 100;
      
      if (
        ratingDrop >= DROP_OFF_CONFIG.minRatingDrop &&
        votesDropPercent >= DROP_OFF_CONFIG.minVotesDropPercent
      ) {
        return {
          season: curr.season,
          episode: curr.number,
          title: curr.title,
        };
      }
    }
    
    return null;
  }

  /**
   * Calculates the percentage of viewers lost at drop-off point.
   */
  private calculateDropOffPercent(
    episodes: Array<EpisodeData & { season: number }>,
    dropOffPoint: NonNullable<DropOffAnalysis['dropOffPoint']>
  ): number {
    const dropIndex = episodes.findIndex(
      ep => ep.season === dropOffPoint.season && ep.number === dropOffPoint.episode
    );
    
    if (dropIndex <= 0) return 0;
    
    const beforeVotes = episodes[dropIndex - 1].votes;
    const atVotes = episodes[dropIndex].votes;
    
    return Math.round(((beforeVotes - atVotes) / beforeVotes) * 100);
  }

  /**
   * Generates human-readable insight based on analysis.
   */
  private generateInsight(
    dropOffPoint: DropOffAnalysis['dropOffPoint'],
    dropOffPercent: number,
    overallRetention: number,
    totalEpisodes: number
  ): { insight: string; insightType: DropOffAnalysis['insightType'] } {
    // No drop-off detected
    if (!dropOffPoint) {
      if (overallRetention >= 70) {
        return {
          insight: 'Серіал тримає аудиторію стабільно від початку до кінця',
          insightType: 'steady',
        };
      }
      return {
        insight: 'Аудиторія поступово зменшується, але без різких падінь',
        insightType: 'steady',
      };
    }

    // Calculate position of drop-off
    const dropPosition = `S${dropOffPoint.season}E${dropOffPoint.episode}`;
    const episodeIndex = (dropOffPoint.season - 1) * 10 + dropOffPoint.episode; // Approximate
    const isEarlyDrop = episodeIndex / totalEpisodes < DROP_OFF_CONFIG.earlyDropThreshold;

    if (isEarlyDrop) {
      return {
        insight: `Багато глядачів кидають рано — біля ${dropPosition}. ${dropOffPercent}% відвалюються`,
        insightType: 'drops_early',
      };
    }

    if (dropOffPoint.season === 1) {
      return {
        insight: `Серіал сильний на старті, але ${dropOffPercent}% глядачів відвалюються до ${dropPosition}`,
        insightType: 'strong_start',
      };
    }

    return {
      insight: `Глядачі втрачають інтерес до ${dropPosition}. ${dropOffPercent}% не продовжують`,
      insightType: 'drops_late',
    };
  }

  /**
   * Returns empty analysis for shows with insufficient data.
   */
  private emptyAnalysis(): DropOffAnalysis {
    return {
      dropOffPoint: null,
      dropOffPercent: 0,
      overallRetention: 0,
      seasonEngagement: [],
      insight: 'Недостатньо даних для аналізу',
      insightType: 'steady',
      analyzedAt: new Date().toISOString(),
      episodesAnalyzed: 0,
    };
  }
}
