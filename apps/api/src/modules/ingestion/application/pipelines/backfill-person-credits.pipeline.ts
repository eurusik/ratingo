import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { Queue } from 'bullmq';
import { and, gt, isNull, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { formatUtcDayId } from '@/common/utils/date.util';
import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';

import { type Credits } from '../../../ingestion/public';
import { type IPersonCreditsWriter, PERSON_CREDITS_WRITER } from '../../../person/public';
import { BACKFILL_QUEUE, IngestionJob, TMDB_BACKFILL_RUN_CAP } from '../../ingestion.constants';

/** Batch size for backfill dispatcher pagination. */
const BACKFILL_BATCH_SIZE = 100;

/**
 * Backfills the persons / media_credits read-model from existing
 * `media_items.credits` JSONB.
 *
 * Without this, only titles synced after the feature shipped would have
 * person credits. Reads no external APIs — pure DB work — so it is safe for the
 * high-throughput backfill queue.
 *
 * 1. Dispatcher: finds media items whose credits contain cast/crew, queues item jobs.
 * 2. Item job: re-reads the credits for one media item and writes the read-model.
 */
@Injectable()
export class BackfillPersonCreditsPipeline {
  private readonly logger = new Logger(BackfillPersonCreditsPipeline.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @InjectQueue(BACKFILL_QUEUE)
    private readonly queue: Queue,
    @Inject(PERSON_CREDITS_WRITER)
    private readonly personCreditsWriter: IPersonCreditsWriter,
  ) {}

  /** Predicate: credits JSONB has at least one cast or crew member. */
  private hasCredits() {
    return sql`(
      jsonb_array_length(coalesce(${schema.mediaItems.credits} -> 'cast', '[]'::jsonb)) > 0
      OR jsonb_array_length(coalesce(${schema.mediaItems.credits} -> 'crew', '[]'::jsonb)) > 0
    )`;
  }

  /** Dispatcher: finds media with credits and queues per-item jobs. */
  async dispatch(): Promise<void> {
    this.logger.log('Starting person-credits backfill dispatcher...');

    const day = formatUtcDayId();
    let cursor: string | undefined;
    let totalQueued = 0;

    while (totalQueued < TMDB_BACKFILL_RUN_CAP) {
      const conditions = [isNull(schema.mediaItems.deletedAt), this.hasCredits()];
      if (cursor) conditions.push(gt(schema.mediaItems.id, cursor));

      const remaining = TMDB_BACKFILL_RUN_CAP - totalQueued;
      const batchSize = Math.min(BACKFILL_BATCH_SIZE, remaining);

      const rows = await withDbError('find person-credits backfill candidates', this.logger, () =>
        this.db
          .select({ id: schema.mediaItems.id })
          .from(schema.mediaItems)
          .where(and(...conditions))
          .orderBy(schema.mediaItems.id)
          .limit(batchSize),
      );

      if (rows.length === 0) break;

      const jobs = rows.map((r) => ({
        name: IngestionJob.BACKFILL_PERSON_CREDITS_ITEM,
        data: { mediaItemId: r.id },
        opts: { jobId: `backfill-person-credits_${r.id}_${day}` },
      }));

      await this.queue.addBulk(jobs);
      totalQueued += jobs.length;
      cursor = rows[rows.length - 1].id;

      this.logger.debug(`Queued ${jobs.length} person-credits jobs (total: ${totalQueued})`);
    }

    if (totalQueued >= TMDB_BACKFILL_RUN_CAP) {
      this.logger.log(
        `Person-credits backfill hit run cap (${TMDB_BACKFILL_RUN_CAP}); remaining items picked up next run`,
      );
    } else {
      this.logger.log(`Person-credits backfill complete: queued=${totalQueued} items`);
    }
  }

  /** Item job: re-reads credits for one media item and writes the read-model. */
  async processItem(mediaItemId: string, jobId: string): Promise<void> {
    const [row] = await withDbError('load credits for backfill', this.logger, () =>
      this.db
        .select({ credits: schema.mediaItems.credits })
        .from(schema.mediaItems)
        .where(sql`${schema.mediaItems.id} = ${mediaItemId}`)
        .limit(1),
    );

    if (!row) {
      this.logger.debug(`[${jobId}] media item ${mediaItemId} not found`);
      return;
    }

    await this.personCreditsWriter.writeFromCredits(mediaItemId, row.credits as Credits | null);
  }
}
