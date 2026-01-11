import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, desc, eq, sql, isNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DEFAULT_PAGE_SIZE } from '@/common/constants';
import { withDbError } from '@/common/utils/db-error.utils';

import { MediaType } from '../../../../common/enums/media-type.enum';
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
    return withDbError(
      'create notification',
      this.logger,
      async () => {
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
      },
      { userId: data.userId, mediaItemId: data.mediaItemId },
    );
  }

  /**
   * Creates multiple notifications in bulk. Returns count of created.
   */
  async createMany(data: CreateNotificationData[]): Promise<number> {
    if (data.length === 0) return 0;

    return withDbError(
      'create notifications bulk',
      this.logger,
      async () => {
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
      },
      { count: data.length },
    );
  }

  /**
   * Lists notifications with media summary, ordered by createdAt desc.
   */
  async listWithMedia(
    userId: string,
    limit = DEFAULT_PAGE_SIZE,
    offset = 0,
  ): Promise<NotificationWithMedia[]> {
    return withDbError(
      'list notifications',
      this.logger,
      async () => {
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
      },
      { userId, limit, offset },
    );
  }

  /**
   * Counts unread notifications.
   */
  async countUnread(userId: string): Promise<number> {
    return withDbError(
      'count unread notifications',
      this.logger,
      async () => {
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
      },
      { userId },
    );
  }

  /**
   * Marks notification as read.
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    return withDbError(
      'mark notification as read',
      this.logger,
      async () => {
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
      },
      { notificationId, userId },
    );
  }

  /**
   * Marks all notifications as read.
   */
  async markAllAsRead(userId: string): Promise<number> {
    return withDbError(
      'mark all notifications as read',
      this.logger,
      async () => {
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
      },
      { userId },
    );
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
