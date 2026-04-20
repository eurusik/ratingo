import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { Queue } from 'bullmq';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MediaType } from '@/common/enums/media-type.enum';
import { formatUtcDayId } from '@/common/utils/date.util';
import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';

import { TmdbAdapter } from '../../../tmdb/public';
import { BACKFILL_QUEUE, IngestionJob, TMDB_BACKFILL_RUN_CAP } from '../../ingestion.constants';

/**
 * Batch size for backfill dispatcher pagination.
 */
const BACKFILL_BATCH_SIZE = 100;

/**
 * Pipeline for backfilling IMDb IDs for shows that are missing them.
 *
 * Root cause: TMDB adapter was not requesting `external_ids` for TV shows,
 * so `imdb_id` was never populated, and OMDb ratings were skipped.
 *
 * This pipeline:
 * 1. Dispatcher: finds all shows with NULL imdb_id and queues item jobs
 * 2. Item job: fetches external IDs from TMDB (single API call) + direct DB update
 *
 * TMDB-only: no Trakt/OMDb/TVMaze calls. Safe for high-throughput backfill queue.
 */
@Injectable()
export class BackfillImdbPipeline {
  private readonly logger = new Logger(BackfillImdbPipeline.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @InjectQueue(BACKFILL_QUEUE)
    private readonly queue: Queue,
    private readonly tmdbAdapter: TmdbAdapter,
  ) {}

  /**
   * Dispatcher: finds shows without IMDb ID and queues re-sync jobs.
   */
  async dispatch(): Promise<void> {
    this.logger.log('Starting IMDb backfill dispatcher...');

    const day = formatUtcDayId();
    let cursor: string | undefined;
    let totalQueued = 0;

    // Paginate with a hard cap on queued jobs. Without the cap, a fresh
    // DB with many ID-less shows would dump 100k+ entries into Redis in a
    // single run and duplicate them on the next manual trigger because
    // the day-scoped jobId would differ.
    while (totalQueued < TMDB_BACKFILL_RUN_CAP) {
      const conditions = [
        eq(schema.mediaItems.type, MediaType.SHOW),
        isNull(schema.mediaItems.imdbId),
        isNull(schema.mediaItems.deletedAt),
      ];

      if (cursor) {
        conditions.push(gt(schema.mediaItems.id, cursor));
      }

      const remaining = TMDB_BACKFILL_RUN_CAP - totalQueued;
      const batchSize = Math.min(BACKFILL_BATCH_SIZE, remaining);

      const rows = await withDbError('find IMDb backfill candidates', this.logger, () =>
        this.db
          .select({
            id: schema.mediaItems.id,
            tmdbId: schema.mediaItems.tmdbId,
          })
          .from(schema.mediaItems)
          .where(and(...conditions))
          .orderBy(schema.mediaItems.id)
          .limit(batchSize),
      );

      if (rows.length === 0) break;

      // Queue item jobs — jobId scoped by UTC day so a failed job from
      // yesterday never blocks today's dispatcher.
      const jobs = rows
        .filter((r) => r.tmdbId !== null)
        .map((r) => ({
          name: IngestionJob.BACKFILL_IMDB_ITEM,
          data: { tmdbId: r.tmdbId },
          opts: { jobId: `backfill-imdb_${r.tmdbId}_${day}` },
        }));

      if (jobs.length > 0) {
        await this.queue.addBulk(jobs);
        totalQueued += jobs.length;
      }

      cursor = rows[rows.length - 1].id;

      this.logger.debug(`Queued ${jobs.length} backfill jobs (total: ${totalQueued})`);
    }

    if (totalQueued >= TMDB_BACKFILL_RUN_CAP) {
      this.logger.log(
        `IMDb backfill dispatcher hit run cap (${TMDB_BACKFILL_RUN_CAP}); remaining shows will be picked up on next run`,
      );
    } else {
      this.logger.log(`IMDb backfill dispatcher complete: queued=${totalQueued} shows`);
    }
  }

  /**
   * Item job: fetches external IDs from TMDB and updates the DB directly.
   * TMDB-only — single API call, no Trakt/OMDb/TVMaze.
   */
  async processItem(tmdbId: number, jobId: string): Promise<void> {
    const result = await this.tmdbAdapter.getExternalIds(tmdbId, MediaType.SHOW);
    if (!result?.imdbId) {
      this.logger.debug(`[${jobId}] No IMDb ID found for tmdbId=${tmdbId}`);
      return;
    }

    await withDbError(
      'persist IMDb id',
      this.logger,
      () =>
        this.db
          .update(schema.mediaItems)
          .set({ imdbId: result.imdbId })
          .where(
            and(eq(schema.mediaItems.tmdbId, tmdbId), eq(schema.mediaItems.type, MediaType.SHOW)),
          ),
      { tmdbId, imdbId: result.imdbId },
    );

    this.logger.debug(`[${jobId}] Updated imdbId for tmdbId=${tmdbId} → ${result.imdbId}`);
  }
}
