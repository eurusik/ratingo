import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, desc, eq, sql, isNull, inArray, or, ne, lt } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DEFAULT_PAGE_SIZE } from '@/common/constants';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { ShowStatus } from '../../../../common/enums/show-status.enum';
import { ImageMapper } from '../../../../common/mappers/image.mapper';
import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  type UserSubscription,
  type SubscriptionTrigger,
  SUBSCRIPTION_TRIGGER,
} from '../../domain/entities/user-subscription.entity';
import {
  type IUserSubscriptionRepository,
  type UpsertSubscriptionData,
  type SubscriptionWithMedia,
  type NotifiedSubscription,
} from '../../domain/repositories/user-subscription.repository.interface';

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
   * For new subscriptions, initializes dedup markers to prevent immediate notifications.
   * For reactivated subscriptions (was inactive), updates markers to current state.
   *
   * @param {UpsertSubscriptionData} data - Upsert payload
   * @returns {Promise<UserSubscription>} Persisted subscription
   */
  async upsert(data: UpsertSubscriptionData): Promise<UserSubscription> {
    return withDbError(
      'upsert subscription',
      this.logger,
      async () => {
        const [row] = await this.db
          .insert(schema.userSubscriptions)
          .values({
            userId: data.userId,
            mediaItemId: data.mediaItemId,
            trigger: data.trigger,
            channel: data.channel ?? 'push',
            isActive: true,
            // Initialize dedup markers to prevent immediate notifications
            lastNotifiedSeasonNumber: data.lastNotifiedSeasonNumber ?? null,
            lastNotifiedEpisodeKey: data.lastNotifiedEpisodeKey ?? null,
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
              // Update markers only if reactivating (was inactive)
              // This is handled by conditional update: only set if current isActive = false
              ...(data.lastNotifiedSeasonNumber !== undefined && {
                lastNotifiedSeasonNumber: sql`CASE WHEN ${schema.userSubscriptions.isActive} = false THEN ${data.lastNotifiedSeasonNumber} ELSE ${schema.userSubscriptions.lastNotifiedSeasonNumber} END`,
              }),
              ...(data.lastNotifiedEpisodeKey !== undefined && {
                lastNotifiedEpisodeKey: sql`CASE WHEN ${schema.userSubscriptions.isActive} = false THEN ${data.lastNotifiedEpisodeKey} ELSE ${schema.userSubscriptions.lastNotifiedEpisodeKey} END`,
              }),
            },
          })
          .returning();
        return this.mapRow(row);
      },
      { userId: data.userId, mediaItemId: data.mediaItemId, trigger: data.trigger },
    );
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
    return withDbError(
      'deactivate subscription',
      this.logger,
      async () => {
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
      },
      { userId, mediaItemId, trigger },
    );
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
    return withDbError(
      'find subscription',
      this.logger,
      async () => {
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
      },
      { userId, mediaItemId, trigger },
    );
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
    return withDbError(
      'find active triggers for media',
      this.logger,
      async () => {
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
      },
      { userId, mediaItemId },
    );
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
    limit = DEFAULT_PAGE_SIZE,
    offset = 0,
  ): Promise<SubscriptionWithMedia[]> {
    return withDbError(
      'list active subscriptions with media',
      this.logger,
      async () => {
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
      },
      { userId },
    );
  }

  /**
   * Counts active subscriptions.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<number>} Count
   */
  async countActive(userId: string): Promise<number> {
    return withDbError(
      'count active subscriptions',
      this.logger,
      async () => {
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
      },
      { userId },
    );
  }

  /**
   * Marks subscription as notified.
   *
   * @param {string} subscriptionId - Subscription identifier
   * @returns {Promise<void>}
   */
  async markNotified(subscriptionId: string): Promise<void> {
    return withDbError(
      'mark subscription as notified',
      this.logger,
      () =>
        this.db
          .update(schema.userSubscriptions)
          .set({ lastNotifiedAt: new Date(), updatedAt: new Date() })
          .where(eq(schema.userSubscriptions.id, subscriptionId))
          .then(() => undefined),
      { subscriptionId },
    );
  }

  /**
   * Finds TMDB IDs of shows that need tracking (have active subscriptions).
   * Filters: active subscription, show type, not ended/canceled, valid tmdbId.
   *
   * @returns {Promise<number[]>} Array of TMDB IDs
   */
  async findTrackedShowTmdbIds(): Promise<number[]> {
    return withDbError('find tracked show TMDB IDs', this.logger, async () => {
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
    });
  }

  async atomicNotifyNewEpisode(
    mediaItemId: string,
    episodeKey: string,
  ): Promise<NotifiedSubscription[]> {
    return withDbError(
      'atomically notify new episode',
      this.logger,
      () =>
        this.db
          .update(schema.userSubscriptions)
          .set({
            lastNotifiedEpisodeKey: episodeKey,
            lastNotifiedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.userSubscriptions.mediaItemId, mediaItemId),
              eq(schema.userSubscriptions.trigger, SUBSCRIPTION_TRIGGER.NEW_EPISODE),
              eq(schema.userSubscriptions.isActive, true),
              or(
                isNull(schema.userSubscriptions.lastNotifiedEpisodeKey),
                ne(schema.userSubscriptions.lastNotifiedEpisodeKey, episodeKey),
              ),
            ),
          )
          .returning({
            id: schema.userSubscriptions.id,
            userId: schema.userSubscriptions.userId,
            mediaItemId: schema.userSubscriptions.mediaItemId,
          }),
      { mediaItemId, episodeKey },
    );
  }

  async atomicNotifyNewSeason(
    mediaItemId: string,
    seasonNumber: number,
  ): Promise<NotifiedSubscription[]> {
    return withDbError(
      'atomically notify new season',
      this.logger,
      () =>
        this.db
          .update(schema.userSubscriptions)
          .set({
            lastNotifiedSeasonNumber: seasonNumber,
            lastNotifiedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.userSubscriptions.mediaItemId, mediaItemId),
              eq(schema.userSubscriptions.trigger, SUBSCRIPTION_TRIGGER.NEW_SEASON),
              eq(schema.userSubscriptions.isActive, true),
              or(
                isNull(schema.userSubscriptions.lastNotifiedSeasonNumber),
                lt(schema.userSubscriptions.lastNotifiedSeasonNumber, seasonNumber),
              ),
            ),
          )
          .returning({
            id: schema.userSubscriptions.id,
            userId: schema.userSubscriptions.userId,
            mediaItemId: schema.userSubscriptions.mediaItemId,
          }),
      { mediaItemId, seasonNumber },
    );
  }

  async deactivateForEndedShow(mediaItemId: string): Promise<number> {
    return withDbError(
      'deactivate subscriptions for ended show',
      this.logger,
      async () => {
        const result = await this.db
          .update(schema.userSubscriptions)
          .set({
            isActive: false,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(schema.userSubscriptions.mediaItemId, mediaItemId),
              eq(schema.userSubscriptions.isActive, true),
              inArray(schema.userSubscriptions.trigger, [
                SUBSCRIPTION_TRIGGER.NEW_SEASON,
                SUBSCRIPTION_TRIGGER.NEW_EPISODE,
              ]),
            ),
          )
          .returning({ id: schema.userSubscriptions.id });
        return result.length;
      },
      { mediaItemId },
    );
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
