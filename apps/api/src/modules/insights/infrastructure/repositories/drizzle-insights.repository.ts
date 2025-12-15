import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { sql, and, eq, gte, inArray } from 'drizzle-orm';
import { InsightsRepository } from '../../domain/repositories/insights.repository.interface';
import { RiseFallItemDto } from '../../presentation/dtos/insights.dto';
import { ImageMapper } from '../../../catalog/infrastructure/mappers/image.mapper';

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
   * @returns {Promise<{ risers: RiseFallItemDto[]; fallers: RiseFallItemDto[] }>}
   *          Lists of biggest risers and fallers by watcher delta
   */
  async getMovements(
    windowDays: number,
    limit: number,
  ): Promise<{ risers: RiseFallItemDto[]; fallers: RiseFallItemDto[] }> {
    // Prepare target dates (Midnight UTC)
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    const prev = new Date(now);
    prev.setUTCDate(prev.getUTCDate() - windowDays);

    const prev2 = new Date(now);
    prev2.setUTCDate(prev2.getUTCDate() - windowDays * 2);

    const targetDates = [now, prev, prev2];

    const formatDateKey = (d: Date) => d.toISOString().split('T')[0];

    try {
      const rows = await this.db
        .select({
          snapshot: schema.mediaWatchersSnapshots,
          media: schema.mediaItems,
        })
        .from(schema.mediaWatchersSnapshots)
        .innerJoin(
          schema.mediaItems,
          eq(schema.mediaWatchersSnapshots.mediaItemId, schema.mediaItems.id),
        )
        .where(
          and(
            eq(schema.mediaWatchersSnapshots.region, 'global'),
            inArray(schema.mediaWatchersSnapshots.snapshotDate, targetDates),
          ),
        );

      const grouped = new Map<
        string,
        { media: (typeof rows)[0]['media']; snapshots: Record<string, number> }
      >();

      for (const row of rows) {
        const id = row.media.id;
        if (!grouped.has(id)) {
          grouped.set(id, { media: row.media, snapshots: {} });
        }
        const dateKey = formatDateKey(row.snapshot.snapshotDate);
        grouped.get(id)!.snapshots[dateKey] = row.snapshot.totalWatchers;
      }

      const items = Array.from(grouped.values()).map(({ media, snapshots }) => {
        const tNow = snapshots[formatDateKey(now)] || 0;
        const tPrev = snapshots[formatDateKey(prev)] || 0;
        const tPrev2 = snapshots[formatDateKey(prev2)] || 0;

        const growthCurrent = tNow - tPrev;
        const growthPrev = tPrev - tPrev2;
        const delta = growthCurrent - growthPrev;

        let deltaPercent = null;
        if (growthPrev !== 0) {
          deltaPercent = (delta / Math.abs(growthPrev)) * 100;
        }

        // Identify new entrants (no growth in previous window, but growth now)
        const isNewInTrends = growthPrev === 0 && growthCurrent > 0;

        return {
          id: media.id,
          mediaItemId: media.id,
          type: media.type,
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
          },
        };
      });

      // Separate Risers & Fallers and Sort
      const risers = items
        .filter((i) => i.stats.deltaWatchers > 0)
        .sort((a, b) => b.stats.deltaWatchers - a.stats.deltaWatchers)
        .slice(0, limit);

      const fallers = items
        .filter((i) => {
          if (i.stats.deltaWatchers >= 0) return false;

          const MIN_PREV_GROWTH = 100;
          const MAX_DROP_PERCENT = -10;

          if (i.stats.growthPrev < MIN_PREV_GROWTH) return false;
          if ((i.stats.deltaPercent || 0) > MAX_DROP_PERCENT) return false;

          return true;
        })
        .sort((a, b) => a.stats.deltaWatchers - b.stats.deltaWatchers)
        .slice(0, limit);

      return { risers, fallers };
    } catch (error) {
      this.logger.error(`Failed to get movements: ${error.message}`, error.stack);
      return { risers: [], fallers: [] };
    }
  }
}
