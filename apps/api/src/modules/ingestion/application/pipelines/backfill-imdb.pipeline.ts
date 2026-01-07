import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { Queue } from 'bullmq';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MediaType } from '@/common/enums/media-type.enum';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';

import { INGESTION_QUEUE, IngestionJob } from '../../ingestion.constants';
import { SyncMediaService } from '../services/sync-media.service';

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
 * 2. Item job: re-syncs the show via SyncMediaService (which now fetches external_ids)
 */
@Injectable()
export class BackfillImdbPipeline {
  private readonly logger = new Logger(BackfillImdbPipeline.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @InjectQueue(INGESTION_QUEUE)
    private readonly queue: Queue,
    private readonly syncService: SyncMediaService,
  ) {}

  /**
   * Dispatcher: finds shows without IMDb ID and queues re-sync jobs.
   */
  async dispatch(): Promise<void> {
    this.logger.log('Starting IMDb backfill dispatcher...');

    let cursor: string | undefined;
    let totalQueued = 0;

    // Paginate through all shows without imdb_id
    while (true) {
      const conditions = [
        eq(schema.mediaItems.type, MediaType.SHOW),
        isNull(schema.mediaItems.imdbId),
        isNull(schema.mediaItems.deletedAt),
      ];

      if (cursor) {
        conditions.push(gt(schema.mediaItems.id, cursor));
      }

      const rows = await this.db
        .select({
          id: schema.mediaItems.id,
          tmdbId: schema.mediaItems.tmdbId,
        })
        .from(schema.mediaItems)
        .where(and(...conditions))
        .orderBy(schema.mediaItems.id)
        .limit(BACKFILL_BATCH_SIZE);

      if (rows.length === 0) break;

      // Queue item jobs
      const jobs = rows
        .filter((r) => r.tmdbId !== null)
        .map((r) => ({
          name: IngestionJob.BACKFILL_IMDB_ITEM,
          data: { tmdbId: r.tmdbId },
          opts: { jobId: `backfill-imdb_${r.tmdbId}` },
        }));

      if (jobs.length > 0) {
        await this.queue.addBulk(jobs);
        totalQueued += jobs.length;
      }

      cursor = rows[rows.length - 1].id;

      this.logger.debug(`Queued ${jobs.length} backfill jobs (total: ${totalQueued})`);
    }

    this.logger.log(`IMDb backfill dispatcher complete: queued=${totalQueued} shows`);
  }

  /**
   * Item job: re-syncs a single show to fetch IMDb ID and OMDb ratings.
   */
  async processItem(tmdbId: number, jobId: string): Promise<void> {
    await this.syncService.syncShow(tmdbId, undefined, jobId);
  }
}
