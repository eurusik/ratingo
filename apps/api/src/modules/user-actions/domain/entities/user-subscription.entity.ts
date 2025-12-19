/**
 * Subscription trigger types.
 * - RELEASE: Movie release notification
 * - NEW_SEASON: New season of a show
 * - NEW_EPISODE: New episode aired
 * - ON_STREAMING: Available on streaming platform
 * - STATUS_CHANGED: Show status changed (e.g., renewed, canceled)
 */
export const SUBSCRIPTION_TRIGGER = {
  RELEASE: 'release',
  NEW_SEASON: 'new_season',
  NEW_EPISODE: 'new_episode',
  ON_STREAMING: 'on_streaming',
  STATUS_CHANGED: 'status_changed',
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
  /** Dedup marker for episode notifications: 'S2E5' format */
  lastNotifiedEpisodeKey: string | null;
  /** Dedup marker for season notifications */
  lastNotifiedSeasonNumber: number | null;
  createdAt: Date;
  updatedAt: Date;
}
