import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { Queue } from 'bullmq';
import { and, gt, isNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MediaType } from '@/common/enums/media-type.enum';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';

import { type IMediaRepository, MEDIA_REPOSITORY } from '../../../catalog/public';
import { ALT_TITLE_COUNTRIES, MAX_ALT_TITLES } from '../../../tmdb/public';
import { TmdbAdapter } from '../../../tmdb/public';
import {
  BACKFILL_ALT_TITLES_BATCH_SIZE,
  BACKFILL_QUEUE,
  IngestionJob,
} from '../../ingestion.constants';

/**
 * Pipeline for backfilling alternative titles from TMDB.
 *
 * Uses lightweight dedicated TMDB endpoints (/movie/{id}/alternative_titles,
 * /tv/{id}/alternative_titles) — no Trakt/OMDb/TVMaze calls needed.
 *
 * Dispatcher: finds items with NULL alternative_titles, queues item jobs.
 * Item job: fetches alt titles from TMDB, filters, updates DB.
 */
@Injectable()
export class BackfillAltTitlesPipeline {
  private readonly logger = new Logger(BackfillAltTitlesPipeline.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @InjectQueue(BACKFILL_QUEUE)
    private readonly queue: Queue,
    private readonly tmdbAdapter: TmdbAdapter,
    @Inject(MEDIA_REPOSITORY)
    private readonly mediaRepository: IMediaRepository,
  ) {}

  /**
   * Dispatcher: finds items without alternative titles and queues fetch jobs.
   */
  async dispatch(): Promise<void> {
    this.logger.log('Starting alt titles backfill dispatcher...');

    let cursor: string | undefined;
    let totalQueued = 0;

    while (true) {
      const conditions = [
        isNull(schema.mediaItems.alternativeTitles),
        isNull(schema.mediaItems.deletedAt),
      ];

      if (cursor) {
        conditions.push(gt(schema.mediaItems.id, cursor));
      }

      const rows = await this.db
        .select({
          id: schema.mediaItems.id,
          tmdbId: schema.mediaItems.tmdbId,
          type: schema.mediaItems.type,
          title: schema.mediaItems.title,
          originalTitle: schema.mediaItems.originalTitle,
        })
        .from(schema.mediaItems)
        .where(and(...conditions))
        .orderBy(schema.mediaItems.id)
        .limit(BACKFILL_ALT_TITLES_BATCH_SIZE);

      if (rows.length === 0) break;

      const jobs = rows
        .filter((r) => r.tmdbId !== null)
        .map((r) => ({
          name: IngestionJob.BACKFILL_ALT_TITLES_ITEM,
          data: {
            mediaItemId: r.id,
            tmdbId: r.tmdbId,
            type: r.type,
            title: r.title,
            originalTitle: r.originalTitle,
          },
          opts: { jobId: `backfill-alt_${r.tmdbId}` },
        }));

      if (jobs.length > 0) {
        await this.queue.addBulk(jobs);
        totalQueued += jobs.length;
      }

      cursor = rows[rows.length - 1].id;

      this.logger.debug(`Queued ${jobs.length} alt title jobs (total: ${totalQueued})`);
    }

    this.logger.log(`Alt titles backfill dispatcher complete: queued=${totalQueued} items`);
  }

  /**
   * Item job: fetches alternative titles from TMDB and updates the DB.
   */
  async processItem(data: {
    mediaItemId: string;
    tmdbId: number;
    type: MediaType;
    title: string;
    originalTitle: string | null;
  }): Promise<void> {
    const rawTitles = await this.tmdbAdapter.getAlternativeTitles(data.tmdbId, data.type);

    const filtered = this.filterAlternativeTitles(rawTitles, data.title, data.originalTitle);

    await this.mediaRepository.updateAlternativeTitles(data.mediaItemId, filtered);
  }

  /**
   * Filters alternative titles: by allowed countries, deduplicates, caps at limit.
   * Simplified version of TmdbMapper.extractAlternativeTitles() — skips origin_country
   * (not stored in DB) and uses only hardcoded ALT_TITLE_COUNTRIES.
   */
  private filterAlternativeTitles(
    rawTitles: { iso_3166_1: string; title: string }[],
    title: string,
    originalTitle: string | null,
  ): string[] {
    if (rawTitles.length === 0) return [];

    const existingTitles = new Set(
      [title, originalTitle].filter(Boolean).map((t) => t!.toLowerCase().trim()),
    );

    const result: string[] = [];
    const seen = new Set<string>();

    for (const entry of rawTitles) {
      if (!ALT_TITLE_COUNTRIES.has(entry.iso_3166_1)) continue;
      const normalized = entry.title?.trim();
      if (!normalized) continue;
      const lower = normalized.toLowerCase();
      if (existingTitles.has(lower) || seen.has(lower)) continue;
      seen.add(lower);
      result.push(normalized);
      if (result.length >= MAX_ALT_TITLES) break;
    }

    return result;
  }
}
