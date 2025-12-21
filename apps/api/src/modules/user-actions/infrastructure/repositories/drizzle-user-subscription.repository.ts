import { Inject, Injectable, Logger } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, desc, eq, sql, isNull, notInArray, inArray } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  IUserSubscriptionRepository,
  UpsertSubscriptionData,
  SubscriptionWithMedia,
} from '../../domain/repositories/user-subscription.repository.interface';
import {
  UserSubscription,
  SubscriptionTrigger,
} from '../../domain/entities/user-subscription.entity';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { ShowStatus } from '../../../../common/enums/show-status.enum';
import { ImageMapper } from '../../../catalog/infrastructure/mappers/image.mapper';

/**
 * Drizzle implementation of user subscription repository.
 */
@Injectable()
export class DrizzleUserSubscriptionRepository implements IUserSubscriptionRepository {
  private readonly logger = new Logger(DrizzleUserSubscriptionRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Upserts a subscription (activates if exists).
   *
   * @param {UpsertSubscriptionData} data - Upsert payload
   * @returns {Promise<UserSubscription>} Persisted subscription
   */
  async upsert(data: UpsertSubscriptionData): Promise<UserSubscription> {
    try {
      const [row] = await this.db
        .insert(schema.userSubscriptions)
        .values({
          userId: data.userId,
          mediaItemId: data.mediaItemId,
          trigger: data.trigger,
          channel: data.channel ?? 'push',
          isActive: true,
        })
        .onConflictDoUpdate({
          target: [
            schema.userSubscriptions.userId,
            schema.userSubscriptions.mediaItemId,
            schema.userSubscriptions.trigger,
            schema.userSubscriptions.channel,
          ],
          set: {
            isActive: true,
            updatedAt: new Date(),
          },
        })
        .returning();
      return this.mapRow(row);
    } catch (error) {
      this.logger.error(`upsert failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to upsert subscription', {
        userId: data.userId,
        mediaItemId: data.mediaItemId,
        trigger: data.trigger,
      });
    }
  }

  /**
   * Deactivates a subscription.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @param {SubscriptionTrigger} trigger - Trigger type
   * @returns {Promise<boolean>} True if deactivated
   */
  async deactivate(
    userId: string,
    mediaItemId: string,
    trigger: SubscriptionTrigger,
  ): Promise<boolean> {
    try {
      const result = await this.db
        .update(schema.userSubscriptions)
        .set({ isActive: false, updatedAt: new Date() })
        .where(
          and(
            eq(schema.userSubscriptions.userId, userId),
            eq(schema.userSubscriptions.mediaItemId, mediaItemId),
            eq(schema.userSubscriptions.trigger, trigger),
          ),
        )
        .returning({ id: schema.userSubscriptions.id });
      return result.length > 0;
    } catch (error) {
      this.logger.error(`deactivate failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to deactivate subscription', {
        userId,
        mediaItemId,
        trigger,
      });
    }
  }

  /**
   * Finds an active subscription.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @param {SubscriptionTrigger} trigger - Trigger type
   * @returns {Promise<UserSubscription | null>} Subscription or null
   */
  async findOne(
    userId: string,
    mediaItemId: string,
    trigger: SubscriptionTrigger,
  ): Promise<UserSubscription | null> {
    try {
      const [row] = await this.db
        .select()
        .from(schema.userSubscriptions)
        .where(
          and(
            eq(schema.userSubscriptions.userId, userId),
            eq(schema.userSubscriptions.mediaItemId, mediaItemId),
            eq(schema.userSubscriptions.trigger, trigger),
            eq(schema.userSubscriptions.isActive, true),
          ),
        )
        .limit(1);
      return row ? this.mapRow(row) : null;
    } catch (error) {
      this.logger.error(`findOne failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to find subscription', { userId, mediaItemId, trigger });
    }
  }

  /**
   * Gets active triggers for a media item.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @returns {Promise<SubscriptionTrigger[]>} Active triggers
   */
  async findActiveTriggersForMedia(
    userId: string,
    mediaItemId: string,
  ): Promise<SubscriptionTrigger[]> {
    try {
      const rows = await this.db
        .select({ trigger: schema.userSubscriptions.trigger })
        .from(schema.userSubscriptions)
        .where(
          and(
            eq(schema.userSubscriptions.userId, userId),
            eq(schema.userSubscriptions.mediaItemId, mediaItemId),
            eq(schema.userSubscriptions.isActive, true),
          ),
        );
      return rows.map((r) => r.trigger as SubscriptionTrigger);
    } catch (error) {
      this.logger.error(`findActiveTriggersForMedia failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to find active triggers for media', {
        userId,
        mediaItemId,
      });
    }
  }

  /**
   * Lists active subscriptions with media summary.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<SubscriptionWithMedia[]>} Subscriptions with media
   */
  async listActiveWithMedia(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<SubscriptionWithMedia[]> {
    try {
      const rows = await this.db
        .select({
          sub: schema.userSubscriptions,
          media: {
            id: schema.mediaItems.id,
            type: schema.mediaItems.type,
            title: schema.mediaItems.title,
            slug: schema.mediaItems.slug,
            posterPath: schema.mediaItems.posterPath,
            releaseDate: schema.mediaItems.releaseDate,
          },
        })
        .from(schema.userSubscriptions)
        .innerJoin(
          schema.mediaItems,
          eq(schema.mediaItems.id, schema.userSubscriptions.mediaItemId),
        )
        .where(
          and(
            eq(schema.userSubscriptions.userId, userId),
            eq(schema.userSubscriptions.isActive, true),
          ),
        )
        .orderBy(desc(schema.userSubscriptions.createdAt))
        .limit(limit)
        .offset(offset);

      return rows.map((r) => ({
        ...this.mapRow(r.sub),
        mediaSummary: {
          id: r.media.id,
          type: r.media.type as MediaType,
          title: r.media.title,
          slug: r.media.slug,
          poster: ImageMapper.toPoster(r.media.posterPath),
          releaseDate: r.media.releaseDate,
        },
      }));
    } catch (error) {
      this.logger.error(`listActiveWithMedia failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to list active subscriptions with media', { userId });
    }
  }

  /**
   * Counts active subscriptions.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<number>} Count
   */
  async countActive(userId: string): Promise<number> {
    try {
      const [row] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.userSubscriptions)
        .where(
          and(
            eq(schema.userSubscriptions.userId, userId),
            eq(schema.userSubscriptions.isActive, true),
          ),
        );
      return Number(row?.count ?? 0);
    } catch (error) {
      this.logger.error(`countActive failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to count active subscriptions', { userId });
    }
  }

  /**
   * Marks subscription as notified.
   *
   * @param {string} subscriptionId - Subscription identifier
   * @returns {Promise<void>}
   */
  async markNotified(subscriptionId: string): Promise<void> {
    try {
      await this.db
        .update(schema.userSubscriptions)
        .set({ lastNotifiedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.userSubscriptions.id, subscriptionId));
    } catch (error) {
      this.logger.error(`markNotified failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to mark subscription as notified', { subscriptionId });
    }
  }

  /**
   * Finds TMDB IDs of shows that need tracking (have active subscriptions).
   * Filters: active subscription, show type, not ended/canceled, valid tmdbId.
   *
   * @returns {Promise<number[]>} Array of TMDB IDs
   */
  async findTrackedShowTmdbIds(): Promise<number[]> {
    try {
      const rows = await this.db
        .selectDistinct({ tmdbId: schema.mediaItems.tmdbId })
        .from(schema.userSubscriptions)
        .innerJoin(
          schema.mediaItems,
          eq(schema.mediaItems.id, schema.userSubscriptions.mediaItemId),
        )
        .innerJoin(schema.shows, eq(schema.shows.mediaItemId, schema.mediaItems.id))
        .where(
          and(
            // Active subscriptions only
            eq(schema.userSubscriptions.isActive, true),
            // Show-related triggers
            inArray(schema.userSubscriptions.trigger, ['new_season', 'new_episode']),
            // Only shows
            eq(schema.mediaItems.type, MediaType.SHOW),
            // Not ended or canceled (status is in shows table)
            sql`${schema.shows.status} NOT IN (${ShowStatus.ENDED}, ${ShowStatus.CANCELED})`,
            // Valid tmdbId
            sql`${schema.mediaItems.tmdbId} IS NOT NULL`,
            // Not soft-deleted
            isNull(schema.mediaItems.deletedAt),
          ),
        )
        .orderBy(schema.mediaItems.tmdbId);

      return rows.map((r) => r.tmdbId).filter((id): id is number => id !== null);
    } catch (error) {
      this.logger.error(`findTrackedShowTmdbIds failed: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to find tracked show TMDB IDs');
    }
  }

  private mapRow(row: typeof schema.userSubscriptions.$inferSelect): UserSubscription {
    return {
      id: row.id,
      userId: row.userId,
      mediaItemId: row.mediaItemId,
      trigger: row.trigger as SubscriptionTrigger,
      channel: row.channel ?? 'push',
      isActive: row.isActive,
      lastNotifiedAt: row.lastNotifiedAt,
      lastNotifiedEpisodeKey: row.lastNotifiedEpisodeKey,
      lastNotifiedSeasonNumber: row.lastNotifiedSeasonNumber,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
