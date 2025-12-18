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

export type UserMediaActionType = (typeof USER_MEDIA_ACTION)[keyof typeof USER_MEDIA_ACTION];

/**
 * Context where the action originated.
 */
export const ACTION_CONTEXT = {
  VERDICT: 'verdict',
  CARD: 'card',
  DETAILS: 'details',
  HERO: 'hero',
} as const;

export type ActionContext = (typeof ACTION_CONTEXT)[keyof typeof ACTION_CONTEXT];

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
