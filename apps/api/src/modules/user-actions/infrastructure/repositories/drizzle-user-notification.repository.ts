import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, desc, eq, sql, isNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DEFAULT_PAGE_SIZE } from '@/common/constants';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { ImageMapper } from '../../../../common/mappers/image.mapper';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  type UserNotification,
  type NotificationPayload,
} from '../../domain/entities/user-notification.entity';
import { type SubscriptionTrigger } from '../../domain/entities/user-subscription.entity';
import {
  type IUserNotificationRepository,
  type CreateNotificationData,
  type NotificationWithMedia,
} from '../../domain/repositories/user-notification.repository.interface';

/**
 * Drizzle implementation of user notification repository.
 */
@Injectable()
export class DrizzleUserNotificationRepository implements IUserNotificationRepository {
  private readonly logger = new Logger(DrizzleUserNotificationRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Creates a notification. Returns null if duplicate (conflict ignored).
   */
  async create(data: CreateNotificationData): Promise<UserNotification | null> {
    try {
      const [row] = await this.db
        .insert(schema.userNotifications)
        .values({
          userId: data.userId,
          mediaItemId: data.mediaItemId,
          subscriptionId: data.subscriptionId,
          trigger: data.trigger,
          payload: data.payload ?? null,
        })
        .onConflictDoNothing()
        .returning();

      return row ? this.mapRow(row) : null;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`create failed: ${msg}`);
      throw new DatabaseException('Failed to create notification');
    }
  }

  /**
   * Creates multiple notifications in bulk. Returns count of created.
   */
  async createMany(data: CreateNotificationData[]): Promise<number> {
    if (data.length === 0) return 0;

    try {
      const result = await this.db
        .insert(schema.userNotifications)
        .values(
          data.map((d) => ({
            userId: d.userId,
            mediaItemId: d.mediaItemId,
            subscriptionId: d.subscriptionId,
            trigger: d.trigger,
            payload: d.payload ?? null,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: schema.userNotifications.id });

      return result.length;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`createMany failed: ${msg}`);
      throw new DatabaseException('Failed to create notifications');
    }
  }

  /**
   * Lists notifications with media summary, ordered by createdAt desc.
   */
  async listWithMedia(
    userId: string,
    limit = DEFAULT_PAGE_SIZE,
    offset = 0,
  ): Promise<NotificationWithMedia[]> {
    try {
      const rows = await this.db
        .select({
          notification: schema.userNotifications,
          media: {
            id: schema.mediaItems.id,
            type: schema.mediaItems.type,
            title: schema.mediaItems.title,
            slug: schema.mediaItems.slug,
            posterPath: schema.mediaItems.posterPath,
          },
        })
        .from(schema.userNotifications)
        .innerJoin(
          schema.mediaItems,
          eq(schema.mediaItems.id, schema.userNotifications.mediaItemId),
        )
        .where(
          and(eq(schema.userNotifications.userId, userId), isNull(schema.mediaItems.deletedAt)),
        )
        .orderBy(desc(schema.userNotifications.createdAt))
        .limit(limit)
        .offset(offset);

      return rows.map((r) => ({
        ...this.mapRow(r.notification),
        mediaSummary: {
          id: r.media.id,
          type: r.media.type as MediaType,
          title: r.media.title,
          slug: r.media.slug,
          poster: ImageMapper.toPoster(r.media.posterPath),
        },
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`listWithMedia failed: ${msg}`);
      throw new DatabaseException('Failed to list notifications');
    }
  }

  /**
   * Counts unread notifications.
   */
  async countUnread(userId: string): Promise<number> {
    try {
      const [row] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.userNotifications)
        .where(
          and(
            eq(schema.userNotifications.userId, userId),
            eq(schema.userNotifications.isRead, false),
          ),
        );
      return Number(row?.count ?? 0);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`countUnread failed: ${msg}`);
      throw new DatabaseException('Failed to count unread notifications');
    }
  }

  /**
   * Marks notification as read.
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    try {
      const result = await this.db
        .update(schema.userNotifications)
        .set({ isRead: true, readAt: new Date() })
        .where(
          and(
            eq(schema.userNotifications.id, notificationId),
            eq(schema.userNotifications.userId, userId),
          ),
        )
        .returning({ id: schema.userNotifications.id });
      return result.length > 0;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`markAsRead failed: ${msg}`);
      throw new DatabaseException('Failed to mark notification as read');
    }
  }

  /**
   * Marks all notifications as read.
   */
  async markAllAsRead(userId: string): Promise<number> {
    try {
      const result = await this.db
        .update(schema.userNotifications)
        .set({ isRead: true, readAt: new Date() })
        .where(
          and(
            eq(schema.userNotifications.userId, userId),
            eq(schema.userNotifications.isRead, false),
          ),
        )
        .returning({ id: schema.userNotifications.id });
      return result.length;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`markAllAsRead failed: ${msg}`);
      throw new DatabaseException('Failed to mark all notifications as read');
    }
  }

  private mapRow(row: typeof schema.userNotifications.$inferSelect): UserNotification {
    return {
      id: row.id,
      userId: row.userId,
      mediaItemId: row.mediaItemId,
      subscriptionId: row.subscriptionId,
      trigger: row.trigger as SubscriptionTrigger,
      payload: row.payload as NotificationPayload | null,
      isRead: row.isRead,
      readAt: row.readAt,
      createdAt: row.createdAt,
    };
  }
}
