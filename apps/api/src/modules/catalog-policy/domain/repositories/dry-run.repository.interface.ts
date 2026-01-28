/**
 * Dry-Run Repository Interface (Port)
 *
 * Domain port for fetching dry-run evaluation data.
 * Implementation in infrastructure layer.
 */

import { type MediaType } from '../../../../common/enums/media-type.enum';

/** DI token for IDryRunRepository */
export const DRY_RUN_REPOSITORY = Symbol('DRY_RUN_REPOSITORY');

/**
 * Raw media item data for dry-run evaluation.
 * Contains all fields needed for policy engine input.
 */
export interface DryRunMediaItem {
  id: string;
  title?: string;
  overview?: string | null;
  originCountries: string[] | null;
  originalLanguage: string | null;
  contentClass: string | null;
  ratingImdb: number | null;
  ratingMetacritic: number | null;
  ratingRottenTomatoes: number | null;
  ratingTrakt: number | null;
  voteCountImdb: number | null;
  voteCountTrakt: number | null;
  qualityScore: number | null;
  popularityScore: number | null;
  freshnessScore: number | null;
  ratingoScore: number | null;
  watchersCount: number | null;
}

/**
 * Current evaluation status for a media item.
 */
export interface CurrentEvaluation {
  mediaItemId: string;
  status: string;
}

/**
 * Repository port for dry-run data access.
 *
 * Separates data fetching from evaluation logic.
 * Implementation lives in infrastructure layer.
 */
export interface IDryRunRepository {
  /**
   * Fetches random sample of media items using TABLESAMPLE.
   *
   * @param limit - Maximum number of items to return
   * @param samplePercent - Percentage of table to sample (BERNOULLI)
   * @returns Array of media items for evaluation
   */
  fetchSampleItems(limit: number, samplePercent: number): Promise<DryRunMediaItem[]>;

  /**
   * Fetches top media items by popularity score.
   *
   * @param limit - Maximum number of items to return
   * @returns Array of media items ordered by popularity
   */
  fetchTopItems(limit: number): Promise<DryRunMediaItem[]>;

  /**
   * Fetches media items filtered by type (movie/show).
   *
   * @param mediaType - Media type to filter by
   * @param limit - Maximum number of items to return
   * @returns Array of media items of specified type
   */
  fetchByTypeItems(mediaType: MediaType, limit: number): Promise<DryRunMediaItem[]>;

  /**
   * Fetches media items filtered by origin country.
   *
   * @param country - ISO 3166-1 alpha-2 country code
   * @param limit - Maximum number of items to return
   * @returns Array of media items from specified country
   */
  fetchByCountryItems(country: string, limit: number): Promise<DryRunMediaItem[]>;

  /**
   * Fetches current evaluation statuses for media items.
   *
   * @param mediaItemIds - Array of media item IDs
   * @returns Map of mediaItemId → evaluation status
   */
  getCurrentEvaluations(mediaItemIds: string[]): Promise<Map<string, CurrentEvaluation>>;
}
