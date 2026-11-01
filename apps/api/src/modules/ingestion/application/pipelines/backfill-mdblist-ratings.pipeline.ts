import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { type JobType, Queue } from 'bullmq';
import { and, eq, gt, isNull, isNotNull, lt, or } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { type MediaType } from '@/common/enums/media-type.enum';
import { formatUtcDayId } from '@/common/utils/date.util';
import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';

import { buildMdblistRatingsJobId } from '../../domain/job-ids';
import { MdblistAdapter } from '../../infrastructure/adapters/mdblist/mdblist.adapter';
import {
  BACKFILL_MDBLIST_RATINGS_BATCH_SIZE,
  IngestionJob,
  MDBLIST_DAILY_BUDGET,
  MDBLIST_RATINGS_REFRESH_DAYS,
  RATINGS_BACKFILL_QUEUE,
} from '../../ingestion.constants';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const PENDING_JOB_STATES: JobType[] = ['waiting', 'prioritized', 'delayed', 'paused', 'active'];

interface PendingJobsSnapshot {
  jobCount: number;
  mediaItemIds: Set<string>;
}

interface MdblistCandidate {
  id: string;
  tmdbId: number | null;
  type: MediaType;
}

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
    if (!this.mdblistAdapter.isConfigured()) {
      this.logger.warn(
        'MDBList ratings backfill dispatcher skipped: MDBLIST_API_KEY is not configured',
      );
      return;
    }

    this.logger.log('Starting MDBList ratings backfill dispatcher...');

    const staleBefore = new Date(Date.now() - MDBLIST_RATINGS_REFRESH_DAYS * MS_PER_DAY);
    const day = formatUtcDayId();
    const pending = await this.getPendingJobs();
    let remainingBudget = MDBLIST_DAILY_BUDGET - pending.jobCount;
    let newlyQueued = 0;
    let cursor: string | undefined;

    while (remainingBudget > 0) {
      const candidates = await this.findCandidates(staleBefore, cursor);
      if (candidates.length === 0) break;

      const jobs = candidates
        .filter((candidate) => candidate.tmdbId !== null && !pending.mediaItemIds.has(candidate.id))
        .slice(0, remainingBudget)
        .map((candidate) => this.toItemJob(candidate, day));

      if (jobs.length > 0) {
        await this.queue.addBulk(jobs);
        newlyQueued += jobs.length;
        remainingBudget -= jobs.length;
      }

      cursor = candidates[candidates.length - 1].id;
      this.logger.debug(`Queued ${jobs.length} MDBList jobs (new total: ${newlyQueued})`);
    }

    this.logDispatchSummary(pending.jobCount, newlyQueued, remainingBudget);
  }

  private async getPendingJobs(): Promise<PendingJobsSnapshot> {
    const jobs = await this.queue.getJobs(PENDING_JOB_STATES);
    const mediaItemIds = new Set<string>();
    let jobCount = 0;
    for (const job of jobs) {
      if (!job) continue;
      jobCount += 1;
      const mediaItemId = (job.data as { mediaItemId?: unknown } | undefined)?.mediaItemId;
      if (typeof mediaItemId === 'string') mediaItemIds.add(mediaItemId);
    }
    return { jobCount, mediaItemIds };
  }

  private findCandidates(
    staleBefore: Date,
    cursor: string | undefined,
  ): Promise<MdblistCandidate[]> {
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

    return withDbError('find MDBList backfill candidates', this.logger, () =>
      this.db
        .select({
          id: schema.mediaItems.id,
          tmdbId: schema.mediaItems.tmdbId,
          type: schema.mediaItems.type,
        })
        .from(schema.mediaItems)
        .where(and(...conditions))
        .orderBy(schema.mediaItems.id)
        .limit(BACKFILL_MDBLIST_RATINGS_BATCH_SIZE),
    );
  }

  private toItemJob(candidate: MdblistCandidate, day: string) {
    return {
      name: IngestionJob.BACKFILL_MDBLIST_RATINGS_ITEM,
      data: {
        mediaItemId: candidate.id,
        tmdbId: candidate.tmdbId,
        type: candidate.type,
      },
      opts: { jobId: buildMdblistRatingsJobId(candidate.id, day) },
    };
  }

  private logDispatchSummary(
    alreadyQueued: number,
    newlyQueued: number,
    remainingBudget: number,
  ): void {
    const summary = `alreadyQueued=${alreadyQueued} newlyQueued=${newlyQueued} budget=${MDBLIST_DAILY_BUDGET}`;
    if (remainingBudget <= 0) {
      this.logger.log(
        `MDBList ratings backfill dispatcher reached daily budget (${summary}). Remaining work will be picked up on next run.`,
      );
    } else {
      this.logger.log(`MDBList ratings backfill dispatcher complete (${summary})`);
    }
  }

  /**
   * Item job: fetches RT ratings from MDBList and updates DB directly.
   *
   * Stamps `rtFetchedAt` only after a successful fetch or a genuine not-found
   * (adapter returns null fields for 404 / no RT entries), so the dispatcher
   * skips this row for the next refresh window and does not endlessly re-poll
   * titles MDBList has no coverage for.
   *
   * Any other failure (401, 429, 5xx, network) is thrown by the adapter and
   * propagates out of this method WITHOUT stamping, so BullMQ retries the job
   * and the row stays eligible instead of being locked out for the refresh
   * window with zero data. If the API key is missing nothing is stamped.
   *
   * Before fetching, re-reads `rtFetchedAt` from the DB and short-circuits
   * if the row was already processed within the refresh window. This is
   * belt-and-braces defence: the dispatcher's budget cap is the primary
   * protection, but a duplicate job can still arrive (admin force=true,
   * BullMQ retries, worker restarts) and would otherwise burn a quota unit.
   */
  async processItem(data: { mediaItemId: string; tmdbId: number; type: MediaType }): Promise<void> {
    if (!this.mdblistAdapter.isConfigured()) {
      this.logger.warn(
        `MDBList item skipped for tmdbId=${data.tmdbId}: MDBLIST_API_KEY is not configured`,
      );
      return;
    }

    // Pre-check: skip if this row was already processed within the refresh
    // window. Saves an MDBList quota unit per redundant job.
    const [existing] = await withDbError(
      'read MDBList rtFetchedAt',
      this.logger,
      () =>
        this.db
          .select({ rtFetchedAt: schema.mediaItems.rtFetchedAt })
          .from(schema.mediaItems)
          .where(eq(schema.mediaItems.id, data.mediaItemId))
          .limit(1),
      { mediaItemId: data.mediaItemId, tmdbId: data.tmdbId },
    );

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

    await withDbError(
      'persist MDBList RT ratings',
      this.logger,
      () =>
        this.db
          .update(schema.mediaItems)
          .set(update)
          .where(eq(schema.mediaItems.id, data.mediaItemId)),
      { mediaItemId: data.mediaItemId, tmdbId: data.tmdbId },
    );

    if (wroteRatings) {
      this.logger.debug(
        `Updated RT for tmdbId=${data.tmdbId}: critics=${ratings.rottenTomatoesCritics} audience=${ratings.rottenTomatoesAudience}`,
      );
    } else {
      this.logger.debug(`No RT data from MDBList for tmdbId=${data.tmdbId}; rtFetchedAt stamped`);
    }
  }
}
