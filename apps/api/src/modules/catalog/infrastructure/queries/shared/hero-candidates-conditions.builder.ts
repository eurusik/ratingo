import { eq, gte, gt, lt, isNull, isNotNull, or, and, type SQL } from 'drizzle-orm';

import { MS_PER_HOUR, MS_PER_DAY } from '@/common/constants';
import { MediaType } from '@/common/enums/media-type.enum';
import * as schema from '@/database/schema';
import { EligibilityStatus, EvaluationContext } from '@/modules/catalog-policy/public';

import { HERO_THRESHOLDS } from '../../../domain/constants/catalog.constants';

/**
 * Options for building hero candidates conditions.
 */
export interface HeroCandidatesConditionsOptions {
  /** Hours since last stats update to consider stale */
  staleThresholdHours: number;
  /** Minimum quality score (default: HERO_THRESHOLDS.MIN_QUALITY_SCORE) */
  minQualityScore?: number;
}

/**
 * Builds WHERE conditions for finding hero candidates with stale stats.
 *
 * Identifies items suitable for Hero or Watching-Now sections that need
 * stats refresh. Conditions include:
 *
 * Base filters:
 * - Not soft-deleted
 * - Has valid TMDB ID
 * - Has poster and backdrop images
 * - ELIGIBLE in TRENDING context (current policy)
 * - Quality score >= threshold (50 for watching-now, 60 for hero)
 * - Popularity score >= MIN_POPULARITY_SCORE_FALLBACK
 * - Has live watchers (watchersCount > 0)
 * - Stats are stale (updatedAt < staleThreshold)
 *
 * Type-specific freshness:
 * - Movies: no freshness gate (theatrical releases have different lifecycle)
 * - Shows: must have recent episode OR upcoming episode announced
 *
 * @param options - Filtering options
 * @returns Array of SQL conditions for WHERE clause
 *
 * @example
 * ```typescript
 * const conditions = buildHeroCandidatesConditions({
 *   staleThresholdHours: 4,
 *   minQualityScore: 50, // Cover both hero (60) and watching-now (50)
 * });
 * // Use with INNER JOIN to catalog_policies (isActive=true)
 * // and media_catalog_evaluations (policy version match)
 * ```
 */
export function buildHeroCandidatesConditions(options: HeroCandidatesConditionsOptions): SQL[] {
  const { staleThresholdHours, minQualityScore = HERO_THRESHOLDS.MIN_QUALITY_SCORE } = options;

  const now = new Date();
  const staleThreshold = new Date(now.getTime() - staleThresholdHours * MS_PER_HOUR);
  const showFreshnessCutoff = new Date(
    now.getTime() - HERO_THRESHOLDS.MAX_DAYS_SINCE_LAST_EPISODE * MS_PER_DAY,
  );

  const conditions: SQL[] = [
    // Base filters
    isNull(schema.mediaItems.deletedAt),
    isNotNull(schema.mediaItems.tmdbId),
    isNotNull(schema.mediaItems.posterPath),
    isNotNull(schema.mediaItems.backdropPath),

    // Quality thresholds
    gte(schema.mediaStats.qualityScore, minQualityScore),
    gte(schema.mediaStats.popularityScore, HERO_THRESHOLDS.MIN_POPULARITY_SCORE_FALLBACK),
    gt(schema.mediaStats.watchersCount, 0),

    // Staleness check
    lt(schema.mediaStats.updatedAt, staleThreshold),

    // Type-specific freshness gate:
    // Movies: no freshness requirement (theatrical releases have different lifecycle)
    // Shows: must be fresh (recent episode OR upcoming episode announced)
    or(
      eq(schema.mediaItems.type, MediaType.MOVIE),
      and(
        eq(schema.mediaItems.type, MediaType.SHOW),
        or(gte(schema.shows.lastAirDate, showFreshnessCutoff), isNotNull(schema.shows.nextAirDate)),
      ),
    ),
  ];

  return conditions;
}

/**
 * Builds JOIN conditions for evaluation table in hero candidates query.
 *
 * Used with INNER JOIN on media_catalog_evaluations to filter for:
 * - Items evaluated under the active policy version
 * - TRENDING context
 * - ELIGIBLE status
 *
 * @returns SQL condition for INNER JOIN ON clause
 *
 * @example
 * ```typescript
 * .innerJoin(schema.catalogPolicies, eq(schema.catalogPolicies.isActive, true))
 * .innerJoin(
 *   schema.mediaCatalogEvaluations,
 *   and(
 *     eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
 *     ...buildHeroCandidatesEvaluationConditions(),
 *   ),
 * )
 * ```
 */
export function buildHeroCandidatesEvaluationConditions(): SQL[] {
  return [
    eq(schema.mediaCatalogEvaluations.policyVersion, schema.catalogPolicies.version),
    eq(schema.mediaCatalogEvaluations.context, EvaluationContext.TRENDING),
    eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
  ];
}
