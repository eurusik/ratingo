/**
 * Saved item list types.
 */
export const SAVED_ITEM_LIST = {
  FOR_LATER: 'for_later',
  CONSIDERING: 'considering',
} as const;

export type SavedItemList = (typeof SAVED_ITEM_LIST)[keyof typeof SAVED_ITEM_LIST];

/**
 * Represents a saved item in user's list.
 */
export interface UserSavedItem {
  id: string;
  userId: string;
  mediaItemId: string;
  list: SavedItemList;
  reasonKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}
