import { Inject, Injectable, Logger } from '@nestjs/common';

import { DEFAULT_PAGE_SIZE } from '@/common/constants';

import {
  type IUserNotificationRepository,
  USER_NOTIFICATION_REPOSITORY,
  type NotificationWithMedia,
  type CreateNotificationData,
} from '../domain/repositories/user-notification.repository.interface';

/**
 * Application service for notification use cases.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(USER_NOTIFICATION_REPOSITORY)
    private readonly notificationRepo: IUserNotificationRepository,
  ) {}

  /**
   * Lists notifications with media for a user.
   */
  async listWithMedia(
    userId: string,
    limit = DEFAULT_PAGE_SIZE,
    offset = 0,
  ): Promise<{ data: NotificationWithMedia[]; unreadCount: number }> {
    const [data, unreadCount] = await Promise.all([
      this.notificationRepo.listWithMedia(userId, limit, offset),
      this.notificationRepo.countUnread(userId),
    ]);
    return { data, unreadCount };
  }

  /**
   * Gets unread count for a user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.countUnread(userId);
  }

  /**
   * Marks a notification as read.
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    return this.notificationRepo.markAsRead(notificationId, userId);
  }

  /**
   * Marks all notifications as read.
   */
  async markAllAsRead(userId: string): Promise<number> {
    const count = await this.notificationRepo.markAllAsRead(userId);
    this.logger.log(`Marked ${count} notifications as read for user ${userId}`);
    return count;
  }

  /**
   * Creates notifications from subscription events.
   * Called by SubscriptionTriggerService when events are detected.
   */
  async createFromEvents(events: CreateNotificationData[]): Promise<number> {
    if (events.length === 0) return 0;
    const created = await this.notificationRepo.createMany(events);
    this.logger.log(`Created ${created} notifications from ${events.length} events`);
    return created;
  }
}
