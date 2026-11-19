import { type SubscriptionTrigger } from './user-subscription.entity';

export const NOTIFICATION_RELEASE_KIND = {
  THEATRICAL: 'theatrical',
  DIGITAL: 'digital',
} as const;

export type NotificationReleaseKind =
  (typeof NOTIFICATION_RELEASE_KIND)[keyof typeof NOTIFICATION_RELEASE_KIND];

/**
 * Payload for notification events.
 */
export interface NotificationPayload {
  seasonNumber?: number;
  episodeKey?: string;
  airDate?: string;
  statusFrom?: string | null;
  statusTo?: string;
  releaseKind?: NotificationReleaseKind;
  releaseCountry?: string | null;
}

/**
 * Represents a notification event triggered by a subscription.
 * These are actual "things that happened" - new season released, etc.
 */
export interface UserNotification {
  id: string;
  userId: string;
  mediaItemId: string;
  subscriptionId: string;
  trigger: SubscriptionTrigger;
  payload: NotificationPayload | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
}
