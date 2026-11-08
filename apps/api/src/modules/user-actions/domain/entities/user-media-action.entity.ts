/**
 * User media action types.
 */
export const USER_MEDIA_ACTION = {
  SAVE_FOR_LATER: 'save_for_later',
  CONSIDER: 'consider',
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
  UNSAVE: 'unsave',
} as const;

/**
 * Context where the action originated.
 */
export const ACTION_CONTEXT = {
  VERDICT: 'verdict',
  CARD: 'card',
  DETAILS: 'details',
  HERO: 'hero',
  IMPORT: 'import',
} as const;

/**
 * Represents a user action event on media.
 */
export interface UserMediaAction {
  id: string;
  userId: string;
  mediaItemId: string;
  action: string;
  context: string | null;
  reasonKey: string | null;
  payload: Record<string, unknown> | null;
  createdAt: Date;
}
