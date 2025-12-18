import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IUserSavedItemRepository,
  USER_SAVED_ITEM_REPOSITORY,
  SavedItemWithMedia,
} from '../domain/repositories/user-saved-item.repository.interface';
import {
  IUserMediaActionRepository,
  USER_MEDIA_ACTION_REPOSITORY,
} from '../domain/repositories/user-media-action.repository.interface';
import { UserSavedItem, SavedItemList, SAVED_ITEM_LIST } from '../domain/entities';
import { USER_MEDIA_ACTION } from '../domain/entities/user-media-action.entity';

/**
 * Payload for saving an item.
 */
export interface SaveItemPayload {
  userId: string;
  mediaItemId: string;
  list: SavedItemList;
  context?: string;
  reasonKey?: string;
}

/**
 * Application service for saved items use cases.
 */
@Injectable()
export class SavedItemsService {
  private readonly logger = new Logger(SavedItemsService.name);

  constructor(
    @Inject(USER_SAVED_ITEM_REPOSITORY)
    private readonly savedItemRepo: IUserSavedItemRepository,
    @Inject(USER_MEDIA_ACTION_REPOSITORY)
    private readonly actionRepo: IUserMediaActionRepository,
  ) {}

  /**
   * Saves an item to a list and logs the action.
   * Automatically removes from the other list (mutual exclusivity).
   *
   * @param {SaveItemPayload} payload - Save payload
   * @returns {Promise<UserSavedItem>} Saved item
   */
  async saveItem(payload: SaveItemPayload): Promise<UserSavedItem> {
    const { userId, mediaItemId, list, context, reasonKey } = payload;

    // Mutual exclusivity: remove from the other list if present
    const otherList =
      list === SAVED_ITEM_LIST.FOR_LATER ? SAVED_ITEM_LIST.CONSIDERING : SAVED_ITEM_LIST.FOR_LATER;

    const wasInOtherList = await this.savedItemRepo.remove(userId, mediaItemId, otherList);
    if (wasInOtherList) {
      this.logger.log(
        `User ${userId} auto-removed ${mediaItemId} from ${otherList} (moved to ${list})`,
      );
    }

    const item = await this.savedItemRepo.upsert({ userId, mediaItemId, list, reasonKey });

    const action =
      list === SAVED_ITEM_LIST.FOR_LATER
        ? USER_MEDIA_ACTION.SAVE_FOR_LATER
        : USER_MEDIA_ACTION.CONSIDER;

    await this.actionRepo.create({
      userId,
      mediaItemId,
      action,
      context: context ?? null,
      reasonKey: reasonKey ?? null,
    });

    this.logger.log(`User ${userId} saved ${mediaItemId} to ${list}`);
    return item;
  }

  /**
   * Removes an item from a list and logs the action.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @param {SavedItemList} list - List type
   * @param {string} context - Action context
   * @returns {Promise<boolean>} True if removed
   */
  async unsaveItem(
    userId: string,
    mediaItemId: string,
    list: SavedItemList,
    context?: string,
  ): Promise<boolean> {
    const removed = await this.savedItemRepo.remove(userId, mediaItemId, list);

    if (removed) {
      await this.actionRepo.create({
        userId,
        mediaItemId,
        action: USER_MEDIA_ACTION.UNSAVE,
        context: context ?? null,
        payload: { list },
      });
      this.logger.log(`User ${userId} unsaved ${mediaItemId} from ${list}`);
    }

    return removed;
  }

  /**
   * Gets lists where item is saved.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @returns {Promise<SavedItemList[]>} Lists
   */
  async getListsForMedia(userId: string, mediaItemId: string): Promise<SavedItemList[]> {
    return this.savedItemRepo.findListsForMedia(userId, mediaItemId);
  }

  /**
   * Lists saved items with media.
   *
   * @param {string} userId - User identifier
   * @param {SavedItemList} list - List type
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<{ total: number; data: SavedItemWithMedia[] }>} Paginated result
   */
  async listWithMedia(
    userId: string,
    list: SavedItemList,
    limit = 20,
    offset = 0,
  ): Promise<{ total: number; data: SavedItemWithMedia[] }> {
    const [total, data] = await Promise.all([
      this.savedItemRepo.count(userId, list),
      this.savedItemRepo.listWithMedia(userId, list, limit, offset),
    ]);
    return { total, data };
  }
}
