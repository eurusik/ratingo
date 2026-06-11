import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { MediaSyncedEvent } from '../../../ingestion/public';
import { SavedItemsService } from '../../../user-actions/public';
import { ACTION_CONTEXT } from '../../../user-actions/public';
import { SAVED_ITEM_LIST } from '../../../user-actions/public';
import {
  IMPORT_BATCH_STATUS,
  IMPORT_PENDING_FAILURE,
  IMPORT_PENDING_REPOSITORY,
  IMPORT_PENDING_STATUS,
} from '../../domain/constants/import-pending.constants';
import { USER_MEDIA_STATE } from '../../domain/entities/user-media-state.entity';
import { type IImportPendingRepository } from '../../domain/repositories/import-pending.repository.interface';
import {
  type IUserMediaStateRepository,
  USER_MEDIA_STATE_REPOSITORY,
} from '../../domain/repositories/user-media-state.repository.interface';

/**
 * Event listener that links newly ingested media items to pending import states.
 *
 * Triggered by 'media.synced' events emitted by SyncMediaService after
 * a full sync pipeline completes and catalog policy has been evaluated.
 *
 * For each pending item waiting for this TMDB ID + type:
 * 1. Creates the user_media_state entry (rating + watch state)
 * 2. Marks the pending item as done
 * 3. Atomically updates batch counters and transitions status if all done
 */
@Injectable()
export class LinkImportListener {
  private readonly logger = new Logger(LinkImportListener.name);

  constructor(
    @Inject(IMPORT_PENDING_REPOSITORY)
    private readonly pendingRepo: IImportPendingRepository,
    @Inject(USER_MEDIA_STATE_REPOSITORY)
    private readonly userMediaRepo: IUserMediaStateRepository,
    private readonly savedItemsService: SavedItemsService,
  ) {}

  @OnEvent(MediaSyncedEvent.eventName)
  async handleMediaSynced(event: MediaSyncedEvent): Promise<void> {
    const items = await this.pendingRepo.findItemsByResolvedTmdb(
      event.tmdbId,
      event.type,
      IMPORT_PENDING_STATUS.INGESTING,
    );

    if (items.length === 0) {
      // No pending imports waiting for this media — common case, no log needed
      return;
    }

    this.logger.log(
      `media.synced: tmdbId=${event.tmdbId} type=${event.type} mediaItemId=${event.mediaItemId} — linking ${items.length} pending item(s)`,
    );

    // Cache batch records to avoid N+1 DB queries across items sharing the same batch
    const batchCache = new Map<
      string,
      Awaited<ReturnType<typeof this.pendingRepo.findBatchById>>
    >();
    const affectedBatchIds = new Set<string>();

    for (const item of items) {
      try {
        let batch = batchCache.get(item.batchId);
        if (batch === undefined) {
          batch = await this.pendingRepo.findBatchById(item.batchId);
          batchCache.set(item.batchId, batch);
        }

        if (!batch) {
          this.logger.warn(`[link] batchId=${item.batchId} not found for itemId=${item.id}`);
          continue;
        }

        if (batch.status === IMPORT_BATCH_STATUS.CANCELLED) {
          this.logger.debug(
            `[link] batchId=${item.batchId} is cancelled, skipping itemId=${item.id}`,
          );
          await this.pendingRepo.updateItemStatus(item.id, {
            status: IMPORT_PENDING_STATUS.CANCELLED,
          });
          continue;
        }

        // Create user_media_state using existing bulkImport (overwrite=false respects existing entries)
        await this.userMediaRepo.bulkImport(
          batch.userId,
          [
            {
              mediaItemId: event.mediaItemId,
              state: item.state,
              rating: item.rating,
            },
          ],
          false,
        );

        if (item.state === USER_MEDIA_STATE.PLANNED) {
          try {
            await this.savedItemsService.saveItem({
              userId: batch.userId,
              mediaItemId: event.mediaItemId,
              list: SAVED_ITEM_LIST.FOR_LATER,
              context: ACTION_CONTEXT.IMPORT,
            });
          } catch (saveError) {
            this.logger.error(
              `[link] Non-critical: failed to save itemId=${item.id} to for_later: ${(saveError as Error).message}`,
              (saveError as Error).stack,
            );
          }
        }

        await this.pendingRepo.updateItemStatus(item.id, {
          status: IMPORT_PENDING_STATUS.DONE,
          mediaItemId: event.mediaItemId,
        });

        affectedBatchIds.add(item.batchId);

        this.logger.debug(
          `[link] itemId=${item.id} userId=${batch.userId} → mediaItemId=${event.mediaItemId} done`,
        );
      } catch (error) {
        this.logger.error(
          `[link] Failed to link itemId=${item.id}: ${(error as Error).message}`,
          (error as Error).stack,
        );

        try {
          await this.pendingRepo.updateItemStatus(item.id, {
            status: IMPORT_PENDING_STATUS.FAILED,
            failureReason: IMPORT_PENDING_FAILURE.LINK_FAILED,
          });
          affectedBatchIds.add(item.batchId);
        } catch (updateError) {
          this.logger.error(
            `[link] Failed to mark itemId=${item.id} as failed: ${(updateError as Error).message}`,
          );
        }
      }
    }

    // Atomic counter update — once per unique batchId after all items are processed
    for (const batchId of affectedBatchIds) {
      try {
        await this.pendingRepo.updateBatchCountersAtomic(batchId);
      } catch (counterError) {
        this.logger.error(
          `[link] Failed to update batch counters for batchId=${batchId}: ${(counterError as Error).message}`,
        );
      }
    }
  }
}
