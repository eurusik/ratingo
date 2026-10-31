import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, eq, inArray, isNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { ImageMapper } from '../../../../common/mappers/image.mapper';
import { type ExternalRatings } from '../../../../common/types';
import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { EligibilityStatus, EvaluationContext } from '../../../catalog-policy/public';
import { type RiseFallItem, type RiseFallMediaType } from '../../domain/models/rise-fall.model';
import { type InsightsRepository } from '../../domain/repositories/insights.repository.interface';

// Fallers filtering thresholds
const MIN_PREV_GROWTH = 100;
const MAX_DROP_PERCENT = -10;
const PERCENT_MULTIPLIER = 100;

/**
 * Drizzle implementation of insights repository.
 *
 * Provides read-only analytical queries used for trends and movements,
 * aggregating watcher snapshots over configurable time windows.
 */
@Injectable()
export class DrizzleInsightsRepository implements InsightsRepository {
  private readonly logger = new Logger(DrizzleInsightsRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Gets media movements (risers and fallers) for the given time window.
   *
   * @param {number} windowDays - Size of the comparison window in days
   * @param {number} limit - Maximum number of items per list
   * @returns {Promise<{ risers: RiseFallItem[]; fallers: RiseFallItem[] }>}
   *          Lists of biggest risers and fallers by watcher delta
   */
  async getMovements(
    windowDays: number,
    limit: number,
  ): Promise<{ risers: RiseFallItem[]; fallers: RiseFallItem[] }> {
    // Prepare target dates (Midnight UTC)
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    const prev = new Date(now);
    prev.setUTCDate(prev.getUTCDate() - windowDays);

    const prev2 = new Date(now);
    prev2.setUTCDate(prev2.getUTCDate() - windowDays * 2);

    const targetDates = [now, prev, prev2];

    const formatDateKey = (d: Date) => d.toISOString().split('T')[0];

    return withDbError('get insights movements', this.logger, async () => {
      // Public endpoint: only live (not soft-deleted) items that are ELIGIBLE under the active
      // catalog policy (same condition as the hero query). Select only the columns we map.
      const rows = await this.db
        .select({
          snapshotDate: schema.mediaWatchersSnapshots.snapshotDate,
          totalWatchers: schema.mediaWatchersSnapshots.totalWatchers,
          id: schema.mediaItems.id,
          type: schema.mediaItems.type,
          slug: schema.mediaItems.slug,
          title: schema.mediaItems.title,
          originalTitle: schema.mediaItems.originalTitle,
          posterPath: schema.mediaItems.posterPath,
          backdropPath: schema.mediaItems.backdropPath,
          rating: schema.mediaItems.rating,
          voteCount: schema.mediaItems.voteCount,
        })
        .from(schema.mediaWatchersSnapshots)
        .innerJoin(
          schema.mediaItems,
          eq(schema.mediaWatchersSnapshots.mediaItemId, schema.mediaItems.id),
        )
        .innerJoin(schema.catalogPolicies, eq(schema.catalogPolicies.isActive, true))
        .innerJoin(
          schema.mediaCatalogEvaluations,
          and(
            eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
            eq(schema.mediaCatalogEvaluations.policyVersion, schema.catalogPolicies.version),
          ),
        )
        .where(
          and(
            eq(schema.mediaWatchersSnapshots.region, 'global'),
            inArray(schema.mediaWatchersSnapshots.snapshotDate, targetDates),
            isNull(schema.mediaItems.deletedAt),
            eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
            eq(schema.mediaCatalogEvaluations.context, EvaluationContext.TRENDING),
          ),
        );

      type MediaRow = Omit<(typeof rows)[0], 'snapshotDate' | 'totalWatchers'>;
      const grouped = new Map<string, { media: MediaRow; snapshots: Record<string, number> }>();

      for (const row of rows) {
        const { snapshotDate, totalWatchers, ...media } = row;
        if (!grouped.has(media.id)) {
          grouped.set(media.id, { media, snapshots: {} });
        }
        grouped.get(media.id)!.snapshots[formatDateKey(snapshotDate)] = totalWatchers;
      }

      const items: RiseFallItem[] = [];

      for (const { media, snapshots } of grouped.values()) {
        const tNow = snapshots[formatDateKey(now)];
        const tPrev = snapshots[formatDateKey(prev)];
        const tPrev2 = snapshots[formatDateKey(prev2)];

        // A missing snapshot is "unknown", not 0 (otherwise lifetime totals look like growth).
        // Each window needs both of its endpoints; skip the item otherwise.
        if (tNow === undefined || tPrev === undefined || tPrev2 === undefined) continue;

        const growthCurrent = tNow - tPrev;
        const growthPrev = tPrev - tPrev2;
        const delta = growthCurrent - growthPrev;

        let deltaPercent = null;
        if (growthPrev !== 0) {
          deltaPercent = (delta / Math.abs(growthPrev)) * PERCENT_MULTIPLIER;
        }

        // Identify new entrants (no growth in previous window, but growth now)
        const isNewInTrends = growthPrev === 0 && growthCurrent > 0;

        items.push({
          id: media.id,
          mediaItemId: media.id,
          type: media.type as RiseFallMediaType,
          slug: media.slug,
          title: media.title,
          originalTitle: media.originalTitle,
          poster: ImageMapper.toPoster(media.posterPath),
          backdrop: ImageMapper.toBackdrop(media.backdropPath),
          stats: {
            deltaWatchers: delta,
            deltaPercent: deltaPercent !== null ? Number(deltaPercent.toFixed(1)) : null,
            currentWatchers: tNow,
            growthCurrent,
            growthPrev,
            isNewInTrends,
          },
          externalRatings: {
            tmdb: {
              rating: Number(media.rating),
              voteCount: Number(media.voteCount),
            },
          } as ExternalRatings,
        });
      }

      // Separate Risers & Fallers and Sort
      const risers = items
        .filter((i) => i.stats.deltaWatchers > 0)
        .sort((a, b) => b.stats.deltaWatchers - a.stats.deltaWatchers)
        .slice(0, limit);

      const fallers = items
        .filter((i) => {
          if (i.stats.deltaWatchers >= 0) return false;

          if (i.stats.growthPrev < MIN_PREV_GROWTH) return false;
          if ((i.stats.deltaPercent || 0) > MAX_DROP_PERCENT) return false;

          return true;
        })
        .sort((a, b) => a.stats.deltaWatchers - b.stats.deltaWatchers)
        .slice(0, limit);

      return { risers, fallers };
    });
  }
}
