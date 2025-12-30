/**
 * Policy Input Mapper
 *
 * Shared utility for mapping database rows to PolicyEngineInput.
 * Used by CatalogEvaluationService and DryRunService.
 */

import { Logger } from '@nestjs/common';
import { PolicyEngineInput, WatchProvidersMap } from '../../domain/types/policy.types';
import { ContentClass, isValidContentClass } from '../../domain/classification.service';

/**
 * Raw media item row from database query.
 * Matches the SELECT fields used in evaluation queries.
 */
export interface MediaItemRow {
  id: string;
  title?: string;
  originCountries: unknown;
  originalLanguage: string | null;
  watchProviders: unknown;
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
}

const DEFAULT_CONTENT_CLASS: ContentClass = 'mainstream';

/**
 * Maps a database row to PolicyEngineInput.
 *
 * Handles:
 * - Type casting for JSONB fields (originCountries, watchProviders)
 * - ContentClass validation with fallback to 'mainstream'
 * - Stats object creation (null if no qualityScore)
 *
 * @param row - Raw database row
 * @param logger - Optional logger for warnings (invalid contentClass)
 * @returns PolicyEngineInput ready for policy engine evaluation
 */
export function mapRowToPolicyEngineInput(row: MediaItemRow, logger?: Logger): PolicyEngineInput {
  // Validate contentClass with fallback
  let contentClass: ContentClass = DEFAULT_CONTENT_CLASS;
  if (!isValidContentClass(row.contentClass)) {
    if (logger) {
      logger.warn(
        `Invalid content_class for media ${row.id}: ${row.contentClass}. Defaulting to mainstream. Consider running backfill job.`,
      );
    }
  } else {
    contentClass = row.contentClass;
  }

  return {
    mediaItem: {
      id: row.id,
      originCountries: row.originCountries as string[] | null,
      originalLanguage: row.originalLanguage,
      watchProviders: row.watchProviders as WatchProvidersMap | null,
      voteCountImdb: row.voteCountImdb,
      voteCountTrakt: row.voteCountTrakt,
      ratingImdb: row.ratingImdb,
      ratingMetacritic: row.ratingMetacritic,
      ratingRottenTomatoes: row.ratingRottenTomatoes,
      ratingTrakt: row.ratingTrakt,
      contentClass,
    },
    stats:
      row.qualityScore !== null
        ? {
            qualityScore: row.qualityScore,
            popularityScore: row.popularityScore,
            freshnessScore: row.freshnessScore,
            ratingoScore: row.ratingoScore,
          }
        : null,
  };
}

/**
 * Maps multiple database rows to PolicyEngineInputs.
 *
 * @param rows - Array of raw database rows
 * @param logger - Optional logger for warnings
 * @returns Array of PolicyEngineInput
 */
export function mapRowsToPolicyEngineInputs(
  rows: MediaItemRow[],
  logger?: Logger,
): PolicyEngineInput[] {
  return rows.map((row) => mapRowToPolicyEngineInput(row, logger));
}
