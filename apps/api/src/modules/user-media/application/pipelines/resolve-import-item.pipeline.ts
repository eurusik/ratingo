import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { type Queue } from 'bullmq';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { INGESTION_QUEUE, IngestionJob } from '../../../ingestion/ingestion.constants';
import {
  IMPORT_PENDING_FAILURE,
  IMPORT_PENDING_REPOSITORY,
  IMPORT_PENDING_STATUS,
} from '../../domain/constants/import-pending.constants';
import { type ImportPendingItem } from '../../domain/entities/import-pending-item';
import { type ITmdbResolverPort, TMDB_RESOLVER } from '../../domain/ports/tmdb-resolver.port';
import { type IImportPendingRepository } from '../../domain/repositories/import-pending.repository.interface';

type ResolvedMedia = { tmdbId: number; type: 'movie' | 'show' };

/**
 * Pipeline for the RESOLVE_IMPORT_ITEM job.
 *
 * Resolves a single pending import item via TMDB:
 * 1. If imdbId present: use TMDB Find API (/find/{imdb_id}?external_source=imdb_id)
 * 2. Else if tmdbId present: try movie then show via /movie/{id} and /tv/{id}
 * 3. If unresolvable: mark as failed with TMDB_NOT_FOUND reason
 * 4. If resolved: update status to 'ingesting', queue SYNC_MOVIE or SYNC_SHOW
 *
 * Runs on the backfill queue. Jobs are idempotent via jobId deduplication.
 */
@Injectable()
export class ResolveImportItemPipeline {
  private readonly logger = new Logger(ResolveImportItemPipeline.name);

  constructor(
    @Inject(IMPORT_PENDING_REPOSITORY)
    private readonly pendingRepo: IImportPendingRepository,
    @Inject(TMDB_RESOLVER)
    private readonly tmdbResolver: ITmdbResolverPort,
    @InjectQueue(INGESTION_QUEUE)
    private readonly ingestionQueue: Queue,
  ) {}

  /**
   * Resolves a single pending import item and queues ingestion if found in TMDB.
   */
  async execute(data: { pendingItemId: string; batchId: string }): Promise<void> {
    const { pendingItemId, batchId } = data;

    const item = await this.pendingRepo.findById(pendingItemId);
    if (!item) {
      this.logger.warn(`[item] pendingItemId=${pendingItemId} not found, skipping`);
      return;
    }

    // Idempotency guard: skip items already in a terminal state.
    // RESOLVING is intentionally NOT skipped — a transient error may leave items stuck
    // in RESOLVING, and they must be reprocessed on retry.
    const SKIP_STATUSES: readonly string[] = [
      IMPORT_PENDING_STATUS.DONE,
      IMPORT_PENDING_STATUS.FAILED,
      IMPORT_PENDING_STATUS.INGESTING,
      IMPORT_PENDING_STATUS.CANCELLED,
    ];
    if (SKIP_STATUSES.includes(item.status)) {
      this.logger.debug(
        `[item] pendingItemId=${pendingItemId} already status=${item.status}, skipping`,
      );
      return;
    }

    // Mark as resolving — skip if the item was cancelled between the status check and this write
    const updated = await this.pendingRepo.updateItemStatusIfNotCancelled(pendingItemId, {
      status: IMPORT_PENDING_STATUS.RESOLVING,
    });
    if (!updated) {
      this.logger.log(
        `[item] pendingItemId=${pendingItemId} was cancelled before resolving, skipping`,
      );
      return;
    }

    let resolved: ResolvedMedia | null = null;

    try {
      resolved = await this.resolveViaTmdb(item);
    } catch (error) {
      // Transient error (network, TMDB timeout, etc.) — do not mark as failed.
      // Leave item in 'resolving' status and rethrow so BullMQ retries the job.
      this.logger.error(
        `[item] pendingItemId=${pendingItemId} TMDB resolution error: ${(error as Error).message}`,
      );
      throw error;
    }

    if (!resolved) {
      this.logger.debug(`[item] pendingItemId=${pendingItemId} not found in TMDB, marking failed`);
      const markedFailed = await this.pendingRepo.updateItemStatusIfNotCancelled(pendingItemId, {
        status: IMPORT_PENDING_STATUS.FAILED,
        failureReason: IMPORT_PENDING_FAILURE.TMDB_NOT_FOUND,
      });
      if (!markedFailed) {
        this.logger.log(
          `[item] pendingItemId=${pendingItemId} was cancelled during TMDB lookup, skipping failed mark`,
        );
        return;
      }
      await this.pendingRepo.updateBatchCountersAtomic(batchId);
      return;
    }

    // Queue catalog ingestion BEFORE marking as INGESTING.
    // If queue.add() fails, the item stays in RESOLVING and can be retried.
    const jobName = resolved.type === 'movie' ? IngestionJob.SYNC_MOVIE : IngestionJob.SYNC_SHOW;
    const mediaTypeName = resolved.type === 'movie' ? MediaType.MOVIE : MediaType.SHOW;

    await this.ingestionQueue.add(
      jobName,
      { tmdbId: resolved.tmdbId, type: mediaTypeName },
      { jobId: `${jobName}-${resolved.tmdbId}` },
    );

    // Only transition to INGESTING after successful queue add.
    // Skip if the item was cancelled while waiting for queue.add() to complete.
    await this.pendingRepo.updateItemStatusIfNotCancelled(pendingItemId, {
      status: IMPORT_PENDING_STATUS.INGESTING,
      resolvedTmdbId: resolved.tmdbId,
      mediaType: resolved.type,
    });

    this.logger.log(
      `[item] pendingItemId=${pendingItemId} queued ${jobName} for tmdbId=${resolved.tmdbId}`,
    );
  }

  /**
   * Resolves a pending item to a TMDB ID + type using available identifiers.
   *
   * Strategy:
   * - IMDB ID (globally unique): single TMDB Find API call
   * - TMDB ID only: check movie first, then show
   */
  private async resolveViaTmdb(item: ImportPendingItem): Promise<ResolvedMedia | null> {
    if (item.imdbId) {
      const result = await this.tmdbResolver.findByImdbId(item.imdbId);
      this.logger.debug(
        `[item] imdbId=${item.imdbId} → ${result ? `${result.type}:${result.tmdbId}` : 'not found'}`,
      );
      return result;
    }

    if (item.tmdbId) {
      const result = await this.resolveByTmdbId(item.tmdbId);
      this.logger.debug(
        `[item] tmdbId=${item.tmdbId} → ${result ? `${result.type}:${result.tmdbId}` : 'not found'}`,
      );
      return result;
    }

    return null;
  }

  /**
   * Checks movie and show existence in parallel for the given TMDB ID.
   * TMDB IDs are unique per type, not globally, so we must check both.
   * Movie takes precedence when both return true (degenerate case).
   */
  private async resolveByTmdbId(tmdbId: number): Promise<ResolvedMedia | null> {
    const [isMovie, isShow] = await Promise.all([
      this.tmdbResolver.checkExists(tmdbId, 'movie'),
      this.tmdbResolver.checkExists(tmdbId, 'show'),
    ]);

    if (isMovie) return { tmdbId, type: 'movie' };
    if (isShow) return { tmdbId, type: 'show' };

    return null;
  }
}
