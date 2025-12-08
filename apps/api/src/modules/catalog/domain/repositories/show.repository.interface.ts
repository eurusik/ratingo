import { DropOffAnalysis } from '../../../shared/drop-off-analyzer';

/**
 * Show data for listing.
 */
export interface ShowListItem {
  tmdbId: number;
  title: string;
}

/**
 * Abstract interface for Show-specific storage operations.
 * Extends catalog functionality with show-specific queries.
 */
export interface IShowRepository {
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
}

export const SHOW_REPOSITORY = Symbol('SHOW_REPOSITORY');
