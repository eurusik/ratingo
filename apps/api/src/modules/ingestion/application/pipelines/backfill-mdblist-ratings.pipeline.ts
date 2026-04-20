import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { Queue } from 'bullmq';
import { and, eq, gt, isNull, isNotNull, lt, or } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { type MediaType } from '@/common/enums/media-type.enum';
import { formatUtcDayId } from '@/common/utils/date.util';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';

import { MdblistAdapter } from '../../infrastructure/adapters/mdblist/mdblist.adapter';
import {
  BACKFILL_MDBLIST_RATINGS_BATCH_SIZE,
  IngestionJob,
  MDBLIST_DAILY_BUDGET,
  MDBLIST_RATINGS_REFRESH_DAYS,
  RATINGS_BACKFILL_QUEUE,
} from '../../ingestion.constants';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Pipeline for backfilling Rotten Tomatoes ratings from MDBList.
 *
 * Complements OMDb, which frequently omits RT values (especially for
 * HBO/serial content). MDBList mirrors the public Rotten Tomatoes pages
 * directly and has substantially better coverage.
 *
 * Flow:
 *  1. Dispatcher (runs on ingestion queue, once per day) scans media_items
 *     for rows with a TMDB id but no Rotten Tomatoes critics score and
 *     queues per-item jobs on the ratings-backfill queue.
 *  2. Item worker (runs on ratings-backfill queue, strictly rate-limited
 *     to 40/hour) calls MDBList and writes the two RT fields directly.
 *
 * Writes bypass the full persistence mapper — this is a targeted rating
 * update, not a full media re-sync. Direct UPDATE keeps other columns
 * untouched and avoids any risk of regressing the sync flow.
 */
@Injectable()
export class BackfillMdblistRatingsPipeline {
  private readonly logger = new Logger(BackfillMdblistRatingsPipeline.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @InjectQueue(RATINGS_BACKFILL_QUEUE)
    private readonly queue: Queue,
    private readonly mdblistAdapter: MdblistAdapter,
  ) {}

  /**
   * Dispatcher: finds items missing RT data and queues MDBList item jobs.
   *
   * Selection criteria:
   *   - tmdbId IS NOT NULL                              (MDBList lookup is TMDB-keyed)
   *   - (ratingRottenTomatoes IS NULL OR ratingRottenTomatoesAudience IS NULL)
   *   - rtFetchedAt IS NULL OR older than refresh window
   *   - deletedAt IS NULL
   *
   * The `rtFetchedAt` check is critical for free-tier cadence: without it,
   * items that MDBList legitimately has no RT data for would be re-polled
   * on every dispatcher run and silently burn the 1000/day quota. After a
   * fetch attempt (success or empty) we stamp `rtFetchedAt` and skip the
   * row for {@link MDBLIST_RATINGS_REFRESH_DAYS} days.
   */
  async dispatch(): Promise<void> {
    this.logger.log('Starting MDBList ratings backfill dispatcher...');

    const staleBefore = new Date(Date.now() - MDBLIST_RATINGS_REFRESH_DAYS * MS_PER_DAY);
    // Per-day jobId scoping: a failed/stuck job from a previous day must not
    // block today's dispatcher from re-queueing the same tmdbId. BullMQ dedup
    // operates across waiting/active/completed/failed sets, so without a day
    // suffix one bad job could block a row indefinitely.
    const day = formatUtcDayId();
    let cursor: string | undefined;
    let totalQueued = 0;

    while (totalQueued < MDBLIST_DAILY_BUDGET) {
      const conditions = [
        isNotNull(schema.mediaItems.tmdbId),
        isNull(schema.mediaItems.deletedAt),
        or(
          isNull(schema.mediaItems.ratingRottenTomatoes),
          isNull(schema.mediaItems.ratingRottenTomatoesAudience),
        )!,
        or(isNull(schema.mediaItems.rtFetchedAt), lt(schema.mediaItems.rtFetchedAt, staleBefore))!,
      ];

      if (cursor) {
        conditions.push(gt(schema.mediaItems.id, cursor));
      }

      // Shrink the batch so we never overshoot the daily budget by more
      // than BACKFILL_MDBLIST_RATINGS_BATCH_SIZE - 1.
      const remaining = MDBLIST_DAILY_BUDGET - totalQueued;
      const batchSize = Math.min(BACKFILL_MDBLIST_RATINGS_BATCH_SIZE, remaining);

      const rows = await this.db
        .select({
          id: schema.mediaItems.id,
          tmdbId: schema.mediaItems.tmdbId,
          type: schema.mediaItems.type,
        })
        .from(schema.mediaItems)
        .where(and(...conditions))
        .orderBy(schema.mediaItems.id)
        .limit(batchSize);

      if (rows.length === 0) break;

      const jobs = rows
        .filter((r) => r.tmdbId !== null)
        .map((r) => ({
          name: IngestionJob.BACKFILL_MDBLIST_RATINGS_ITEM,
          data: {
            mediaItemId: r.id,
            tmdbId: r.tmdbId,
            type: r.type,
          },
          // Dedup: one in-flight job per (tmdbId, UTC day). The day suffix
          // prevents a failed job from yesterday blocking today's re-queue.
          opts: { jobId: `backfill-mdblist-ratings_${r.tmdbId}_${day}` },
        }));

      if (jobs.length > 0) {
        await this.queue.addBulk(jobs);
        totalQueued += jobs.length;
      }

      cursor = rows[rows.length - 1].id;

      this.logger.debug(`Queued ${jobs.length} MDBList jobs (total: ${totalQueued})`);
    }

    if (totalQueued >= MDBLIST_DAILY_BUDGET) {
      this.logger.log(
        `MDBList ratings backfill dispatcher reached daily budget (${MDBLIST_DAILY_BUDGET} items); remaining work will be picked up on next run`,
      );
    } else {
      this.logger.log(`MDBList ratings backfill dispatcher complete: queued=${totalQueued} items`);
    }
  }

  /**
   * Item job: fetches RT ratings from MDBList and updates DB directly.
   *
   * ALWAYS stamps `rtFetchedAt` on a real fetch (even when MDBList returns
   * no data) so the dispatcher skips this row for the next refresh window —
   * preventing endless re-polling for titles MDBList has no coverage for.
   *
   * Before fetching, re-reads `rtFetchedAt` from the DB and short-circuits
   * if the row was already processed within the refresh window. This is
   * belt-and-braces defence: the dispatcher's budget cap is the primary
   * protection, but a duplicate job can still arrive (admin force=true,
   * BullMQ retries, worker restarts) and would otherwise burn a quota unit.
   *
   * Best-effort on the network side: if MDBList is unreachable, the
   * adapter returns nulls and this method no-ops on ratings but still
   * bumps `rtFetchedAt` — acceptable, because the alternative (retrying
   * forever on a MDBList outage) burns more quota than the ~90-day delay.
   */
  async processItem(data: { mediaItemId: string; tmdbId: number; type: MediaType }): Promise<void> {
    // Pre-check: skip if this row was already processed within the refresh
    // window. Saves an MDBList quota unit per redundant job.
    const [existing] = await this.db
      .select({ rtFetchedAt: schema.mediaItems.rtFetchedAt })
      .from(schema.mediaItems)
      .where(eq(schema.mediaItems.id, data.mediaItemId))
      .limit(1);

    if (existing?.rtFetchedAt) {
      const staleBefore = new Date(Date.now() - MDBLIST_RATINGS_REFRESH_DAYS * MS_PER_DAY);
      if (existing.rtFetchedAt >= staleBefore) {
        this.logger.debug(
          `Skipping tmdbId=${data.tmdbId}: rtFetchedAt within refresh window (quota preserved)`,
        );
        return;
      }
    }

    const ratings = await this.mdblistAdapter.getRottenTomatoesRatings(data.tmdbId, data.type);

    const update: Partial<typeof schema.mediaItems.$inferInsert> = {
      rtFetchedAt: new Date(),
    };

    if (ratings.rottenTomatoesCritics != null) {
      update.ratingRottenTomatoes = ratings.rottenTomatoesCritics;
    }
    if (ratings.rottenTomatoesAudience != null) {
      update.ratingRottenTomatoesAudience = ratings.rottenTomatoesAudience;
    }

    // Only bump `updatedAt` when actual rating data changed, so downstream
    // cache-invalidation keyed on media_items.updated_at is not flooded by
    // every rt_fetched_at bump.
    const wroteRatings =
      update.ratingRottenTomatoes != null || update.ratingRottenTomatoesAudience != null;
    if (wroteRatings) {
      update.updatedAt = new Date();
    }

    await this.db
      .update(schema.mediaItems)
      .set(update)
      .where(eq(schema.mediaItems.id, data.mediaItemId));

    if (wroteRatings) {
      this.logger.debug(
        `Updated RT for tmdbId=${data.tmdbId}: critics=${ratings.rottenTomatoesCritics} audience=${ratings.rottenTomatoesAudience}`,
      );
    } else {
      this.logger.debug(`No RT data from MDBList for tmdbId=${data.tmdbId}; rtFetchedAt stamped`);
    }
  }
}
