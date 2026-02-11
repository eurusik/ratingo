import { type ImageDto } from '../../../../common/dtos/image.dto';
import { type MediaType } from '../../../../common/enums/media-type.enum';
import {
  type UserNotification,
  type NotificationPayload,
} from '../entities/user-notification.entity';
import { type SubscriptionTrigger } from '../entities/user-subscription.entity';

/**
 * Injection token for user notification repository.
 */
export const USER_NOTIFICATION_REPOSITORY = Symbol('USER_NOTIFICATION_REPOSITORY');

/**
 * Payload for creating a notification.
 */
export interface CreateNotificationData {
  userId: string;
  mediaItemId: string;
  subscriptionId: string;
  trigger: SubscriptionTrigger;
  payload?: NotificationPayload | null;
}

/**
 * Notification with media summary for list display.
 */
export interface NotificationWithMedia extends UserNotification {
  mediaSummary: {
    id: string;
    type: MediaType;
    title: string;
    slug: string;
    poster: ImageDto | null;
  };
}

/**
 * Repository contract for user notification operations.
 */
export interface IUserNotificationRepository {
  /**
   * Creates a notification. Ignores duplicates (same user/media/trigger/payload).
   */
  create(data: CreateNotificationData): Promise<UserNotification | null>;

  /**
   * Creates multiple notifications in bulk.
   */
  createMany(data: CreateNotificationData[]): Promise<number>;

  /**
   * Lists notifications with media summary.
   */
  listWithMedia(
    userId: string,
    limit?: number,
    offset?: number,
    unread?: boolean,
  ): Promise<NotificationWithMedia[]>;

  /**
   * Counts total notifications (optionally filtered by unread).
   */
  countTotal(userId: string, unread?: boolean): Promise<number>;

  /**
   * Counts unread notifications.
   */
  countUnread(userId: string): Promise<number>;

  /**
   * Marks notification as read.
   */
  markAsRead(notificationId: string, userId: string): Promise<boolean>;

  /**
   * Marks all notifications as read.
   */
  markAllAsRead(userId: string): Promise<number>;
}
