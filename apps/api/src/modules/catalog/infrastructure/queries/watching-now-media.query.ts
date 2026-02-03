import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, desc, and, lte, isNotNull, gte, isNull, or } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MS_PER_DAY } from '../../../../common/constants';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { type HeroMediaItem } from '../../../../common/types/hero-media.types';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { EligibilityStatus, EvaluationContext } from '../../../catalog-policy/public';
import { WATCHING_NOW_THRESHOLDS } from '../../domain/constants/catalog.constants';

import { type HeroQueryRow, fetchShowProgress, mapHeroResults } from './shared/hero-item.mapper';
import { HERO_SELECT_FIELDS } from './shared/hero-select-fields';

/**
 * Options for watching now media query.
 */
export interface WatchingNowOptions {
  limit: number;
}

/**
 * Fetches top media items for the "Watching Now" (Зараз дивляться) block.
 *
 * Unlike Hero, this query uses strict freshness rules to show only
 * content that is genuinely "new" and being actively watched:
 * - Movies: released within last 45 days
 * - Shows: last episode aired within 21 days OR has next episode scheduled
 * - Must have watchers_count > 0 (live watchers from Trakt)
 *
 * This excludes "eternal" shows like Friends that are always being watched
 * but aren't actually fresh/relevant content.
 */
@Injectable()
export class WatchingNowMediaQuery {
  private readonly logger = new Logger(WatchingNowMediaQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Executes the watching now query.
   * Returns Top-N items sorted by live watchers count (descending).
   */
  async execute(options: WatchingNowOptions): Promise<HeroMediaItem[]> {
    const { limit } = options;

    try {
      const now = new Date();
      const results = await this.queryWatchingNowItems({ limit, now });

      if (results.length === 0) {
        this.logger.debug('No watching now items found');
        return [];
      }

      const showProgressMap = await fetchShowProgress(this.db, results, now);
      return mapHeroResults(results, showProgressMap, now);
    } catch (error) {
      this.logger.error('Failed to find watching now items', {
        error: (error as Error).message,
        stack: (error as Error).stack,
        limit: options.limit,
      });
      return [];
    }
  }

  /**
   * Queries items with strict freshness criteria:
   * - Movies: releaseDate >= (now - 45 days)
   * - Shows: lastAirDate >= (now - 21 days) OR nextAirDate exists
   * - watchers_count > 0
   */
  private async queryWatchingNowItems(params: {
    limit: number;
    now: Date;
  }): Promise<HeroQueryRow[]> {
    const { limit, now } = params;

    const movieFreshnessCutoff = new Date(
      now.getTime() - WATCHING_NOW_THRESHOLDS.MAX_DAYS_SINCE_MOVIE_RELEASE * MS_PER_DAY,
    );
    const showFreshnessCutoff = new Date(
      now.getTime() - WATCHING_NOW_THRESHOLDS.MAX_DAYS_SINCE_SHOW_EPISODE * MS_PER_DAY,
    );

    const whereConditions = [
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
          or(
            gte(schema.shows.lastAirDate, showFreshnessCutoff),
            isNotNull(schema.shows.nextAirDate),
          ),
        ),
      ),
    ];

    return (
      this.db
        .select(HERO_SELECT_FIELDS)
        .from(schema.mediaItems)
        // Join with active policy (exactly 1 row due to DB constraint on isActive)
        // This enables joining evaluations by policy version
        .innerJoin(schema.catalogPolicies, eq(schema.catalogPolicies.isActive, true))
        .innerJoin(
          schema.mediaCatalogEvaluations,
          and(
            eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
            eq(schema.mediaCatalogEvaluations.policyVersion, schema.catalogPolicies.version),
          ),
        )
        // INNER JOIN: WatchingNow requires watchers data (unlike Hero which uses LEFT JOIN for fallback)
        .innerJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
        .leftJoin(schema.shows, eq(schema.mediaItems.id, schema.shows.mediaItemId))
        .where(and(...whereConditions))
        .orderBy(
          desc(schema.mediaStats.watchersCount),
          desc(schema.mediaStats.ratingoScore),
          schema.mediaItems.id, // deterministic tiebreaker for stable ordering
        )
        .limit(limit)
    );
  }
}
