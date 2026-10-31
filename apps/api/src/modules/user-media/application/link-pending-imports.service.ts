import { Inject, Injectable, Logger } from '@nestjs/common';

import { CLOCK_PORT, type IClockPort } from '../../shared/clock';
import { ACTION_CONTEXT, SAVED_ITEM_LIST, SavedItemsService } from '../../user-actions/public';
import {
  IMPORT_BATCH_STATUS,
  IMPORT_PENDING_FAILURE,
  IMPORT_PENDING_REPOSITORY,
  IMPORT_PENDING_STATUS,
} from '../domain/constants/import-pending.constants';
import { type ImportBatch } from '../domain/entities/import-batch';
import { type ReadyMedia } from '../domain/entities/ready-media';
import { USER_MEDIA_STATE } from '../domain/entities/user-media-state.entity';
import { staleLinkingCutoffMs } from '../domain/policies/pending-link-sweep.policy';
import {
  type IImportPendingRepository,
  type PendingMediaLink,
  type UpdatePendingItemInput,
} from '../domain/repositories/import-pending.repository.interface';
import {
  type IUserMediaStateRepository,
  USER_MEDIA_STATE_REPOSITORY,
} from '../domain/repositories/user-media-state.repository.interface';

type BatchLookup = (batchId: string) => Promise<ImportBatch | null>;
type LinkOutcome = 'linked' | 'failed' | 'skipped';

@Injectable()
export class LinkPendingImportsService {
  private readonly logger = new Logger(LinkPendingImportsService.name);

  constructor(
    @Inject(IMPORT_PENDING_REPOSITORY)
    private readonly pendingRepo: IImportPendingRepository,
    @Inject(USER_MEDIA_STATE_REPOSITORY)
    private readonly userMediaRepo: IUserMediaStateRepository,
    private readonly savedItemsService: SavedItemsService,
    @Inject(CLOCK_PORT)
    private readonly clock: IClockPort,
  ) {}

  async linkReadyMedia(media: ReadyMedia): Promise<number> {
    const items = await this.pendingRepo.findItemsByResolvedTmdb(
      media.tmdbId,
      media.type,
      IMPORT_PENDING_STATUS.INGESTING,
    );
    if (items.length === 0) {
      return 0;
    }

    this.logger.log(
      `tmdbId=${media.tmdbId} type=${media.type} mediaItemId=${media.mediaItemId}: linking ${items.length} pending item(s)`,
    );
    return this.linkItems(items.map((item) => ({ item, mediaItemId: media.mediaItemId })));
  }

  async linkItems(links: PendingMediaLink[]): Promise<number> {
    const findBatch = this.cachedBatchLookup();
    const affectedBatchIds = new Set<string>();
    let linked = 0;

    for (const link of links) {
      const outcome = await this.linkItem(link, findBatch);
      if (outcome === 'skipped') continue;
      affectedBatchIds.add(link.item.batchId);
      if (outcome === 'linked') linked++;
    }

    await this.refreshBatchCounters(affectedBatchIds);
    return linked;
  }

  async failTimedOutIngests(before: Date, limit: number): Promise<number> {
    const batchIds = await this.pendingRepo.failIngestingUpdatedBefore(before, limit);
    if (batchIds.length === 0) {
      return 0;
    }

    this.logger.warn(
      `[timeout] marked ${batchIds.length} item(s) ${IMPORT_PENDING_FAILURE.INGEST_FAILED}: still ingesting since before ${before.toISOString()}`,
    );
    await this.refreshBatchCounters(new Set(batchIds));
    return batchIds.length;
  }

  private async linkItem(link: PendingMediaLink, findBatch: BatchLookup): Promise<LinkOutcome> {
    const { item } = link;
    const batch = await this.claimWithinBatch(item, findBatch);
    if (!batch) return 'skipped';

    try {
      return await this.completeLink(batch.userId, link);
    } catch (error) {
      this.logger.error(
        `[link] Failed to link itemId=${item.id}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return this.markLinkFailed(item.id);
    }
  }

  private async claimWithinBatch(
    item: PendingMediaLink['item'],
    findBatch: BatchLookup,
  ): Promise<ImportBatch | null> {
    try {
      const batch = await this.findLinkableBatch(item, findBatch);
      if (!batch) return null;
      if (!(await this.claim(item.id))) {
        this.logger.debug(`[link] itemId=${item.id} already claimed by another linker`);
        return null;
      }
      return batch;
    } catch (error) {
      this.logger.error(
        `[link] itemId=${item.id} left for the sweeper, could not claim it: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async findLinkableBatch(
    item: PendingMediaLink['item'],
    findBatch: BatchLookup,
  ): Promise<ImportBatch | null> {
    const batch = await findBatch(item.batchId);
    if (!batch) {
      this.logger.warn(`[link] batchId=${item.batchId} not found for itemId=${item.id}`);
      return null;
    }

    if (batch.status === IMPORT_BATCH_STATUS.CANCELLED) {
      this.logger.debug(`[link] batchId=${item.batchId} is cancelled, skipping itemId=${item.id}`);
      await this.pendingRepo.transitionItemStatus(item.id, item.status, {
        status: IMPORT_PENDING_STATUS.CANCELLED,
      });
      return null;
    }

    return batch;
  }

  private claim(itemId: string): Promise<boolean> {
    const staleLinkingBefore = new Date(staleLinkingCutoffMs(this.clock.now().getTime()));
    return this.pendingRepo.claimForLinking(itemId, staleLinkingBefore);
  }

  private async completeLink(
    userId: string,
    link: PendingMediaLink,
  ): Promise<Exclude<LinkOutcome, 'failed'>> {
    const { item, mediaItemId } = link;
    await this.importUserState(userId, link);

    const done = await this.leaveLinking(item.id, {
      status: IMPORT_PENDING_STATUS.DONE,
      mediaItemId,
    });
    if (!done) {
      this.logger.warn(`[link] itemId=${item.id} lost its claim before it was marked done`);
      return 'skipped';
    }

    this.logger.debug(
      `[link] itemId=${item.id} userId=${userId} → mediaItemId=${mediaItemId} done`,
    );
    return 'linked';
  }

  private async importUserState(
    userId: string,
    { item, mediaItemId }: PendingMediaLink,
  ): Promise<void> {
    const { state, rating } = item;
    const importResult = await this.userMediaRepo.bulkImport(
      userId,
      [{ mediaItemId, state, rating }],
      false,
    );

    const isNewlyPlanned =
      state === USER_MEDIA_STATE.PLANNED && importResult.plannedMediaItemIds.includes(mediaItemId);
    if (!isNewlyPlanned) return;

    try {
      await this.savedItemsService.saveItem({
        userId,
        mediaItemId,
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

  private async markLinkFailed(itemId: string): Promise<Exclude<LinkOutcome, 'linked'>> {
    try {
      const failed = await this.leaveLinking(itemId, {
        status: IMPORT_PENDING_STATUS.FAILED,
        failureReason: IMPORT_PENDING_FAILURE.LINK_FAILED,
      });
      return failed ? 'failed' : 'skipped';
    } catch (updateError) {
      this.logger.error(
        `[link] Failed to mark itemId=${itemId} as failed: ${(updateError as Error).message}`,
      );
      return 'skipped';
    }
  }

  private leaveLinking(itemId: string, update: UpdatePendingItemInput): Promise<boolean> {
    return this.pendingRepo.transitionItemStatus(itemId, IMPORT_PENDING_STATUS.LINKING, update);
  }

  private cachedBatchLookup(): BatchLookup {
    const batches = new Map<string, ImportBatch | null>();
    return async (batchId) => {
      if (!batches.has(batchId)) {
        batches.set(batchId, await this.pendingRepo.findBatchById(batchId));
      }
      return batches.get(batchId);
    };
  }

  private async refreshBatchCounters(batchIds: Set<string>): Promise<void> {
    for (const batchId of batchIds) {
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
