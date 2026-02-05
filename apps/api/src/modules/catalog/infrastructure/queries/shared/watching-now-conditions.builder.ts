import { eq, lte, isNotNull, gte, isNull, or, and, type SQL } from 'drizzle-orm';

import { MS_PER_DAY } from '../../../../../common/constants';
import { IngestionStatus } from '../../../../../common/enums/ingestion-status.enum';
import { MediaType } from '../../../../../common/enums/media-type.enum';
import * as schema from '../../../../../database/schema';
import { EligibilityStatus, EvaluationContext } from '../../../../catalog-policy/public';
import { WATCHING_NOW_THRESHOLDS } from '../../../domain/constants/catalog.constants';

/**
 * Options for building watching now conditions.
 */
export interface WatchingNowConditionsOptions {
  /** Current timestamp for freshness calculations */
  now: Date;
}

/**
 * Builds WHERE conditions for "Watching Now" (Зараз дивляться) query.
 *
 * Returns conditions for:
 * - Basic sanity (releaseDate <= now, posterPath, backdropPath)
 * - Quality score >= MIN_QUALITY_SCORE
 * - Eligibility (status=ELIGIBLE, context=TRENDING, ingestionStatus=READY, deletedAt)
 * - Watchers (isNotNull + >= MIN_WATCHERS)
 * - Freshness gate OR condition:
 *   - Movies: released within 45 days
 *   - Shows: last episode within 21 days OR has nextAirDate
 *
 * @param options - Options containing current timestamp
 * @returns Array of SQL conditions for WHERE clause
 */
export function buildWatchingNowConditions(options: WatchingNowConditionsOptions): SQL[] {
  const { now } = options;

  const movieFreshnessCutoff = new Date(
    now.getTime() - WATCHING_NOW_THRESHOLDS.MAX_DAYS_SINCE_MOVIE_RELEASE * MS_PER_DAY,
  );
  const showFreshnessCutoff = new Date(
    now.getTime() - WATCHING_NOW_THRESHOLDS.MAX_DAYS_SINCE_SHOW_EPISODE * MS_PER_DAY,
  );

  return [
    // Basic sanity checks
    lte(schema.mediaItems.releaseDate, now),
    isNotNull(schema.mediaItems.posterPath),
    isNotNull(schema.mediaItems.backdropPath),
    gte(schema.mediaStats.qualityScore, WATCHING_NOW_THRESHOLDS.MIN_QUALITY_SCORE),
    eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
    eq(schema.mediaCatalogEvaluations.context, EvaluationContext.TRENDING),
    eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
    isNull(schema.mediaItems.deletedAt),

    // Must have live watchers (strong signal) - explicit NULL check + threshold
    isNotNull(schema.mediaStats.watchersCount),
    gte(schema.mediaStats.watchersCount, WATCHING_NOW_THRESHOLDS.MIN_WATCHERS),

    // Strict freshness gate:
    // - Movies: released within MAX_DAYS_SINCE_MOVIE_RELEASE days
    // - Shows: last episode within MAX_DAYS_SINCE_SHOW_EPISODE days OR has next episode
    or(
      // Fresh movie
      and(
        eq(schema.mediaItems.type, MediaType.MOVIE),
        gte(schema.mediaItems.releaseDate, movieFreshnessCutoff),
      ),
      // Fresh show (recent episode or upcoming)
      and(
        eq(schema.mediaItems.type, MediaType.SHOW),
        or(gte(schema.shows.lastAirDate, showFreshnessCutoff), isNotNull(schema.shows.nextAirDate)),
      ),
    ),
  ];
}
