/**
 * Subscription trigger types.
 */
export const SUBSCRIPTION_TRIGGER = {
  RELEASE: 'release',
  NEW_SEASON: 'new_season',
  ON_STREAMING: 'on_streaming',
} as const;

export type SubscriptionTrigger = (typeof SUBSCRIPTION_TRIGGER)[keyof typeof SUBSCRIPTION_TRIGGER];

/**
 * Represents a user subscription for notifications.
 */
export interface UserSubscription {
  id: string;
  userId: string;
  mediaItemId: string;
  trigger: SubscriptionTrigger;
  channel: string;
  isActive: boolean;
  lastNotifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
