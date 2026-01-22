/**
 * Policy Input Mapper
 *
 * Shared utility for mapping database rows to PolicyEngineInput.
 * Used by CatalogEvaluationService and DryRunService.
 */

import { type Logger } from '@nestjs/common';

import * as schema from '../../../../database/schema';
import { type ContentClass, isValidContentClass } from '../../domain/classification.service';
import { type PolicyEngineInput, type NormalizedOffer } from '../../domain/types/policy.types';

/**
 * Raw media item row from database query.
 * Matches the SELECT fields used in evaluation queries.
 */
export interface MediaItemRow {
  id: string;
  title?: string;
  overview?: string | null;
  originCountries: unknown;
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
}

/**
 * Common SELECT fields for policy evaluation queries.
 * Used by CatalogEvaluationService and DryRunService.
 */
export const POLICY_EVALUATION_SELECT_FIELDS = {
  id: schema.mediaItems.id,
  title: schema.mediaItems.title,
  overview: schema.mediaItems.overview,
  originCountries: schema.mediaItems.originCountries,
  originalLanguage: schema.mediaItems.originalLanguage,
  contentClass: schema.mediaItems.contentClass,
  ratingImdb: schema.mediaItems.ratingImdb,
  ratingMetacritic: schema.mediaItems.ratingMetacritic,
  ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,
  ratingTrakt: schema.mediaItems.ratingTrakt,
  voteCountImdb: schema.mediaItems.voteCountImdb,
  voteCountTrakt: schema.mediaItems.voteCountTrakt,
  qualityScore: schema.mediaStats.qualityScore,
  popularityScore: schema.mediaStats.popularityScore,
  freshnessScore: schema.mediaStats.freshnessScore,
  ratingoScore: schema.mediaStats.ratingoScore,
};

const DEFAULT_CONTENT_CLASS: ContentClass = 'mainstream';

/**
 * Maps a database row to PolicyEngineInput.
 *
 * Handles:
 * - Type casting for JSONB fields (originCountries)
 * - ContentClass validation with fallback to 'mainstream'
 * - Stats object creation (null if no qualityScore)
 * - Normalized offers from media_watch_offers table
 *
 * @param row - Raw database row
 * @param normalizedOffers - Pre-fetched normalized offers for this media item
 * @param logger - Optional logger for warnings (invalid contentClass)
 * @returns PolicyEngineInput ready for policy engine evaluation
 */
export function mapRowToPolicyEngineInput(
  row: MediaItemRow,
  normalizedOffers: NormalizedOffer[] = [],
  logger?: Logger,
): PolicyEngineInput {
  // Validate contentClass with fallback
  let contentClass: ContentClass = DEFAULT_CONTENT_CLASS;
  const { contentClass: rowContentClass } = row;
  if (!isValidContentClass(rowContentClass)) {
    if (logger) {
      logger.warn(
        `Invalid content_class for media ${row.id}: ${rowContentClass}. Defaulting to mainstream.`,
      );
    }
  } else {
    contentClass = rowContentClass;
  }

  return {
    mediaItem: {
      id: row.id,
      originCountries: row.originCountries as string[] | null,
      originalLanguage: row.originalLanguage,
      normalizedOffers,
      voteCountImdb: row.voteCountImdb,
      voteCountTrakt: row.voteCountTrakt,
      ratingImdb: row.ratingImdb,
      ratingMetacritic: row.ratingMetacritic,
      ratingRottenTomatoes: row.ratingRottenTomatoes,
      ratingTrakt: row.ratingTrakt,
      contentClass,
      title: row.title ?? null,
      overview: row.overview ?? null,
    },
    // Normalize scores from 0-100 (DB format) to 0-1 (policy engine format)
    // Policy engine expects normalized values for minQualityScoreNormalized comparisons
    stats:
      row.qualityScore !== null
        ? {
            qualityScore: row.qualityScore / 100,
            popularityScore: row.popularityScore !== null ? row.popularityScore / 100 : null,
            freshnessScore: row.freshnessScore !== null ? row.freshnessScore / 100 : null,
            ratingoScore: row.ratingoScore !== null ? row.ratingoScore / 100 : null,
          }
        : null,
  };
}

/**
 * Maps multiple database rows to PolicyEngineInputs.
 *
 * @param rows - Array of raw database rows
 * @param offersMap - Map of mediaItemId → normalized offers
 * @param logger - Optional logger for warnings
 * @returns Array of PolicyEngineInput
 */
export function mapRowsToPolicyEngineInputs(
  rows: MediaItemRow[],
  offersMap: Map<string, NormalizedOffer[]> = new Map(),
  logger?: Logger,
): PolicyEngineInput[] {
  return rows.map((row) => mapRowToPolicyEngineInput(row, offersMap.get(row.id) ?? [], logger));
}
