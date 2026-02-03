import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, desc, and, lte, isNotNull, gte, isNull, notInArray, or } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MS_PER_DAY } from '../../../../common/constants';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { type HeroMediaItem } from '../../../../common/types/hero-media.types';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { EligibilityStatus, EvaluationContext } from '../../../catalog-policy/public';
import { HERO_THRESHOLDS } from '../../domain/constants/catalog.constants';

import { type HeroQueryRow, fetchShowProgress, mapHeroResults } from './shared/hero-item.mapper';
import { HERO_SELECT_FIELDS } from './shared/hero-select-fields';

/**
 * Options for hero media query.
 */
export interface HeroMediaOptions {
  limit: number;
  type?: MediaType;
}

/**
 * Fetches top media items for the Hero block on homepage.
 *
 * Retrieves high-quality, popular media with proper assets (posters/backdrops).
 * For TV shows, also fetches episode progress using optimized batch queries.
 *
 * @throws Returns empty array on error (non-critical feature)
 */
@Injectable()
export class HeroMediaQuery {
  private readonly logger = new Logger(HeroMediaQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Executes the hero media query with two-pass strategy.
   * First pass: strict criteria (high popularity).
   * Second pass: fallback with relaxed popularity if strict didn't fill limit.
   * Only returns ELIGIBLE items (filtered via media_catalog_evaluations).
   */
  async execute(options: HeroMediaOptions): Promise<HeroMediaItem[]> {
    const { limit, type } = options;

    try {
      const now = new Date();

      const strictResults = await this.queryHeroItems({
        limit,
        type,
        now,
        minPopularityScore: HERO_THRESHOLDS.MIN_POPULARITY_SCORE,
        excludeIds: [],
      });

      if (strictResults.length >= limit) {
        const showProgressMap = await fetchShowProgress(this.db, strictResults, now);
        return mapHeroResults(strictResults, showProgressMap, now);
      }

      const remaining = limit - strictResults.length;
      const strictIds = strictResults.map((r) => r.id);
      const fallbackBuffer = 2;

      const fallbackResults = await this.queryHeroItems({
        limit: remaining + fallbackBuffer,
        type,
        now,
        minPopularityScore: HERO_THRESHOLDS.MIN_POPULARITY_SCORE_FALLBACK,
        excludeIds: strictIds,
      });

      const combined = [...strictResults, ...fallbackResults.slice(0, remaining)];

      this.logger.debug(
        `Hero query: strict=${strictResults.length} fallback=${Math.min(fallbackResults.length, remaining)} total=${combined.length}`,
      );

      const showProgressMap = await fetchShowProgress(this.db, combined, now);
      return mapHeroResults(combined, showProgressMap, now);
    } catch (error) {
      this.logger.error(`Failed to find hero items: ${error.message}`, error.stack);
      return [];
    }
  }

  /**
   * Queries hero items with configurable popularity threshold.
   */
  private async queryHeroItems(params: {
    limit: number;
    type?: MediaType;
    now: Date;
    minPopularityScore: number;
    excludeIds: string[];
  }): Promise<HeroQueryRow[]> {
    const { limit, type, now, minPopularityScore, excludeIds } = params;

    const showFreshnessCutoff = new Date(
      now.getTime() - HERO_THRESHOLDS.MAX_DAYS_SINCE_LAST_EPISODE * MS_PER_DAY,
    );

    const whereConditions = [
      lte(schema.mediaItems.releaseDate, now),
      isNotNull(schema.mediaItems.posterPath),
      isNotNull(schema.mediaItems.backdropPath),
      gte(schema.mediaStats.qualityScore, HERO_THRESHOLDS.MIN_QUALITY_SCORE),
      gte(schema.mediaStats.popularityScore, minPopularityScore),
      eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
      eq(schema.mediaCatalogEvaluations.context, EvaluationContext.TRENDING),
      eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
      isNull(schema.mediaItems.deletedAt),
      or(
        eq(schema.mediaItems.type, MediaType.MOVIE),
        gte(schema.shows.lastAirDate, showFreshnessCutoff),
        isNotNull(schema.shows.nextAirDate),
      ),
    ];

    if (type) {
      whereConditions.push(eq(schema.mediaItems.type, type));
    }

    if (excludeIds.length > 0) {
      whereConditions.push(notInArray(schema.mediaItems.id, excludeIds));
    }

    return this.db
      .select(HERO_SELECT_FIELDS)
      .from(schema.mediaItems)
      .innerJoin(schema.catalogPolicies, eq(schema.catalogPolicies.isActive, true))
      .innerJoin(
        schema.mediaCatalogEvaluations,
        and(
          eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
          eq(schema.mediaCatalogEvaluations.policyVersion, schema.catalogPolicies.version),
        ),
      )
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .leftJoin(schema.shows, eq(schema.mediaItems.id, schema.shows.mediaItemId))
      .where(and(...whereConditions))
      .orderBy(
        desc(schema.mediaStats.watchersCount),
        desc(schema.mediaStats.ratingoScore),
        desc(schema.mediaItems.releaseDate),
      )
      .limit(limit);
  }
}
