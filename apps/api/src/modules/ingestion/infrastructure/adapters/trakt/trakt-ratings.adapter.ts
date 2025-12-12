import { Injectable } from '@nestjs/common';
import { BaseTraktHttp } from './base-trakt-http';
import { EpisodeData, SeasonData } from './interfaces/trakt.types';

/**
 * Trakt adapter for ratings, watchers, stats, and episode/season metadata.
 */
@Injectable()
export class TraktRatingsAdapter extends BaseTraktHttp {
  /**
   * Retrieves detailed ratings for a movie.
   */
  async getMovieRatings(
    idOrSlug: string | number,
  ): Promise<{ rating: number; votes: number; distribution?: Record<string, number> }> {
    return this.fetch(`/movies/${idOrSlug}/ratings`);
  }

  /**
   * Retrieves detailed ratings for a show.
   */
  async getShowRatings(
    idOrSlug: string | number,
  ): Promise<{ rating: number; votes: number; distribution?: Record<string, number> }> {
    return this.fetch(`/shows/${idOrSlug}/ratings`);
  }

  /**
   * Gets count of users currently watching a movie.
   */
  async getMovieWatchers(traktIdOrSlug: string | number): Promise<number> {
    try {
      const watchers = await this.fetch<any[]>(`/movies/${traktIdOrSlug}/watching`);
      return watchers.length;
    } catch {
      return 0;
    }
  }

  /**
   * Retrieves full stats for a movie (watchers, plays, collected, etc.)
   */
  async getMovieStats(
    traktIdOrSlug: string | number,
  ): Promise<{ watchers: number; plays: number; votes: number }> {
    try {
      return await this.fetch(`/movies/${traktIdOrSlug}/stats`);
    } catch {
      return { watchers: 0, plays: 0, votes: 0 };
    }
  }

  /**
   * Gets count of users currently watching a show.
   */
  async getShowWatchers(traktIdOrSlug: string | number): Promise<number> {
    try {
      const watchers = await this.fetch<any[]>(`/shows/${traktIdOrSlug}/watching`);
      return watchers.length;
    } catch {
      return 0;
    }
  }

  /**
   * Retrieves full stats for a show.
   */
  async getShowStats(
    traktIdOrSlug: string | number,
  ): Promise<{ watchers: number; plays: number; votes: number }> {
    try {
      return await this.fetch(`/shows/${traktIdOrSlug}/stats`);
    } catch {
      return { watchers: 0, plays: 0, votes: 0 };
    }
  }

  /**
   * Get movie ratings and watchers by TMDB ID.
   * First looks up the Trakt ID, then fetches ratings and watchers.
   */
  async getMovieRatingsByTmdbId(
    tmdbId: number,
  ): Promise<{ rating: number; votes: number; watchers: number; totalWatchers: number } | null> {
    try {
      const results = await this.fetch<any[]>(`/search/tmdb/${tmdbId}?type=movie`);
      if (!results.length || !results[0]?.movie?.ids?.trakt) {
        return null;
      }
      const traktId = results[0].movie.ids.trakt;

      const [ratingsResult, watchersResult, statsResult] = await Promise.allSettled([
        this.getMovieRatings(traktId),
        this.getMovieWatchers(traktId),
        this.getMovieStats(traktId),
      ]);

      if (ratingsResult.status === 'rejected') {
        throw ratingsResult.reason;
      }

      const ratings = ratingsResult.value;
      const watchers = watchersResult.status === 'fulfilled' ? watchersResult.value : 0;
      const stats = statsResult.status === 'fulfilled' ? statsResult.value : { watchers: 0 };

      return {
        rating: ratings.rating,
        votes: ratings.votes,
        watchers,
        totalWatchers: stats.watchers,
      };
    } catch (error) {
      this.logger.warn(`Failed to get Trakt data for TMDB ${tmdbId}: ${error}`);
      return null;
    }
  }

  /**
   * Get show ratings and watchers by TMDB ID.
   * First looks up the Trakt ID, then fetches ratings.
   */
  async getShowRatingsByTmdbId(
    tmdbId: number,
  ): Promise<{ rating: number; votes: number; watchers: number; totalWatchers: number } | null> {
    try {
      const results = await this.fetch<any[]>(`/search/tmdb/${tmdbId}?type=show`);
      if (!results.length || !results[0]?.show?.ids?.trakt) {
        return null;
      }
      const traktId = results[0].show.ids.trakt;

      const [ratingsResult, watchersResult, statsResult] = await Promise.allSettled([
        this.getShowRatings(traktId),
        this.getShowWatchers(traktId),
        this.getShowStats(traktId),
      ]);

      if (ratingsResult.status === 'rejected') {
        throw ratingsResult.reason;
      }

      const ratings = ratingsResult.value;
      const watchers = watchersResult.status === 'fulfilled' ? watchersResult.value : 0;
      const stats = statsResult.status === 'fulfilled' ? statsResult.value : { watchers: 0 };

      return {
        rating: ratings.rating,
        votes: ratings.votes,
        watchers,
        totalWatchers: stats.watchers,
      };
    } catch (error) {
      this.logger.warn(`Failed to get Trakt data for TMDB ${tmdbId}: ${error}`);
      return null;
    }
  }

  /**
   * Gets Trakt ID for a show by TMDB ID.
   */
  async getTraktIdByTmdbId(tmdbId: number): Promise<number | null> {
    try {
      const results = await this.fetch<any[]>(`/search/tmdb/${tmdbId}?type=show`);
      return results[0]?.show?.ids?.trakt || null;
    } catch {
      return null;
    }
  }

  /**
   * Gets all seasons for a show.
   */
  async getShowSeasons(traktId: number): Promise<Array<{ number: number; episodeCount: number }>> {
    try {
      const seasons = await this.fetch<SeasonData[]>(`/shows/${traktId}/seasons`);
      return seasons
        .filter((s) => s.number > 0)
        .map((s) => ({
          number: s.number,
          episodeCount: s.episode_count || 0,
        }));
    } catch (error) {
      this.logger.warn(`Failed to get seasons for ${traktId}: ${error}`);
      return [];
    }
  }

  /**
   * Gets all episodes for a season with ratings.
   */
  async getSeasonEpisodes(
    traktId: number,
    seasonNumber: number,
  ): Promise<Array<{ number: number; title: string; rating: number; votes: number }>> {
    try {
      const episodes = await this.fetch<EpisodeData[]>(
        `/shows/${traktId}/seasons/${seasonNumber}?extended=full`,
      );
      return episodes.map((ep) => ({
        number: ep.number,
        title: ep.title || `Episode ${ep.number}`,
        rating: ep.rating || 0,
        votes: ep.votes || 0,
      }));
    } catch (error) {
      this.logger.warn(`Failed to get S${seasonNumber} episodes: ${error}`);
      return [];
    }
  }

  /**
   * Gets all episodes for a show (all seasons) for drop-off analysis.
   * Returns structured data ready for analysis.
   */
  async getShowEpisodesForAnalysis(tmdbId: number): Promise<{
    traktId: number;
    seasons: Array<{
      number: number;
      episodes: Array<{ number: number; title: string; rating: number; votes: number }>;
    }>;
  } | null> {
    try {
      const traktId = await this.getTraktIdByTmdbId(tmdbId);
      if (!traktId) return null;

      const seasons = await this.getShowSeasons(traktId);
      if (!seasons.length) return null;

      const seasonData = await Promise.all(
        seasons.slice(0, 10).map(async (s) => ({
          number: s.number,
          episodes: await this.getSeasonEpisodes(traktId, s.number),
        })),
      );

      return {
        traktId,
        seasons: seasonData.filter((s) => s.episodes.length > 0),
      };
    } catch (error) {
      this.logger.warn(`Failed to get episodes for TMDB ${tmdbId}: ${error}`);
      return null;
    }
  }
}
