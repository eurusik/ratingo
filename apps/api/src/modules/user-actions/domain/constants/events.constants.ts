export const SHOW_EVENTS = {
  NEW_EPISODE: 'show.new-episode',
} as const;

export const SAVED_ITEM_EVENTS = {
  SAVED_FOR_LATER: 'saved-item.for-later',
} as const;

export interface SavedForLaterEvent {
  userId: string;
  mediaItemId: string;
}
