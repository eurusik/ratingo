import { UserSavedItem, SavedItemList } from '../entities/user-saved-item.entity';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { ImageDto } from '../../../catalog/presentation/dtos/common.dto';

/**
 * Injection token for user saved item repository.
 */
export const USER_SAVED_ITEM_REPOSITORY = Symbol('USER_SAVED_ITEM_REPOSITORY');

/**
 * Payload for upserting a saved item.
 */
export interface UpsertSavedItemData {
  userId: string;
  mediaItemId: string;
  list: SavedItemList;
  reasonKey?: string | null;
}

/**
 * Saved item with media summary for list display.
 */
export interface SavedItemWithMedia extends UserSavedItem {
  mediaSummary: {
    id: string;
    type: MediaType;
    title: string;
    slug: string;
    poster: ImageDto | null;
    releaseDate?: Date | null;
  };
}

/**
 * Repository contract for user saved item operations.
 */
export interface IUserSavedItemRepository {
  /**
   * Upserts a saved item.
   *
   * @param {UpsertSavedItemData} data - Upsert payload
   * @returns {Promise<UserSavedItem>} Persisted item
   */
  upsert(data: UpsertSavedItemData): Promise<UserSavedItem>;

  /**
   * Removes a saved item.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @param {SavedItemList} list - List type
   * @returns {Promise<boolean>} True if deleted
   */
  remove(userId: string, mediaItemId: string, list: SavedItemList): Promise<boolean>;

  /**
   * Finds a saved item.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @param {SavedItemList} list - List type
   * @returns {Promise<UserSavedItem | null>} Item or null
   */
  findOne(userId: string, mediaItemId: string, list: SavedItemList): Promise<UserSavedItem | null>;

  /**
   * Checks if item is saved in any list.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @returns {Promise<SavedItemList[]>} Lists where item is saved
   */
  findListsForMedia(userId: string, mediaItemId: string): Promise<SavedItemList[]>;

  /**
   * Lists saved items with media summary.
   *
   * @param {string} userId - User identifier
   * @param {SavedItemList} list - List type
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<SavedItemWithMedia[]>} Items with media
   */
  listWithMedia(
    userId: string,
    list: SavedItemList,
    limit?: number,
    offset?: number,
  ): Promise<SavedItemWithMedia[]>;

  /**
   * Counts saved items in a list.
   *
   * @param {string} userId - User identifier
   * @param {SavedItemList} list - List type
   * @returns {Promise<number>} Count
   */
  count(userId: string, list: SavedItemList): Promise<number>;
}
