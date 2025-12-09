import { DropOffAnalysis } from '../../../shared/drop-off-analyzer';
import { NormalizedSeason } from '../../../ingestion/domain/models/normalized-media.model';

/**
 * Show data for listing.
 */
export interface ShowListItem {
  tmdbId: number;
  title: string;
}

export interface CalendarEpisode {
  showId: string;
  showTitle: string;
  posterPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  overview: string | null;
  airDate: Date;
  runtime: number | null;
  stillPath: string | null;
}

/**
 * Abstract interface for Show-specific storage operations.
 * Extends catalog functionality with show-specific queries.
 */
export interface IShowRepository {
  /**
   * Upserts show details (called by orchestrator).
   */
  upsertDetails(
    tx: any, // We use 'any' here to avoid exposing Drizzle types to domain, implementation casts it
    mediaId: string,
    details: {
      totalSeasons?: number | null;
      totalEpisodes?: number | null;
      lastAirDate?: Date | null;
      nextAirDate?: Date | null;
      status?: string | null;
      seasons?: NormalizedSeason[];
    }
  ): Promise<void>;

  /**
   * Gets shows for drop-off analysis.
   * Returns shows that need analysis (no analysis or outdated).
   */
  findShowsForAnalysis(limit: number): Promise<ShowListItem[]>;

  /**
   * Saves drop-off analysis for a show.
   */
  saveDropOffAnalysis(tmdbId: number, analysis: DropOffAnalysis): Promise<void>;

  /**
   * Gets drop-off analysis for a show by TMDB ID.
   */
  getDropOffAnalysis(tmdbId: number): Promise<DropOffAnalysis | null>;

  /**
   * Finds episodes airing within a date range for the global calendar.
   */
  findEpisodesByDateRange(startDate: Date, endDate: Date): Promise<CalendarEpisode[]>;
}

export const SHOW_REPOSITORY = Symbol('SHOW_REPOSITORY');
