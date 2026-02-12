import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, desc, eq, lte } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DEFAULT_PAGE_SIZE } from '@/common/constants';

import { DATABASE_CONNECTION } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import { type UserSubscription, type SubscriptionTrigger } from '../domain/entities';
import { USER_MEDIA_ACTION } from '../domain/entities/user-media-action.entity';
import { SUBSCRIPTION_TRIGGER } from '../domain/entities/user-subscription.entity';
import {
  type IUserMediaActionRepository,
  USER_MEDIA_ACTION_REPOSITORY,
} from '../domain/repositories/user-media-action.repository.interface';
import {
  type IUserSubscriptionRepository,
  USER_SUBSCRIPTION_REPOSITORY,
  type SubscriptionWithMedia,
} from '../domain/repositories/user-subscription.repository.interface';

/**
 * Payload for subscribing to notifications.
 */
export interface SubscribePayload {
  userId: string;
  mediaItemId: string;
  trigger: SubscriptionTrigger;
  context?: string;
  reasonKey?: string;
}

/**
 * Current show state for initializing dedup markers.
 */
interface ShowCurrentState {
  lastEpisodeKey: string | null;
}

/**
 * Parses season number from episode key (e.g., 'S2E5' -> 2).
 */
function parseSeasonFromEpisodeKey(key: string | null): number | null {
  if (!key) return null;
  const match = key.match(/^S(\d+)E\d+$/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Application service for subscription use cases.
 */
@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @Inject(USER_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepo: IUserSubscriptionRepository,
    @Inject(USER_MEDIA_ACTION_REPOSITORY)
    private readonly actionRepo: IUserMediaActionRepository,
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Subscribes to notifications and logs the action.
   * Initializes dedup markers to current state to prevent immediate notifications.
   *
   * @param {SubscribePayload} payload - Subscribe payload
   * @returns {Promise<UserSubscription>} Subscription
   */
  async subscribe(payload: SubscribePayload): Promise<UserSubscription> {
    const { userId, mediaItemId, trigger, context, reasonKey } = payload;

    // Get initial dedup markers based on current show state
    const initialMarkers: {
      lastNotifiedSeasonNumber?: number | null;
      lastNotifiedEpisodeKey?: string | null;
    } = {};

    if (
      trigger === SUBSCRIPTION_TRIGGER.NEW_SEASON ||
      trigger === SUBSCRIPTION_TRIGGER.NEW_EPISODE
    ) {
      const showState = await this.getShowCurrentState(mediaItemId);
      if (showState) {
        // Use aired season (from lastEpisodeKey) not totalSeasons
        // This prevents marking "announced but not aired" seasons as seen
        const airedSeason = parseSeasonFromEpisodeKey(showState.lastEpisodeKey) ?? 0;

        if (trigger === SUBSCRIPTION_TRIGGER.NEW_SEASON) {
          initialMarkers.lastNotifiedSeasonNumber = airedSeason;
        }
        if (trigger === SUBSCRIPTION_TRIGGER.NEW_EPISODE) {
          initialMarkers.lastNotifiedEpisodeKey = showState.lastEpisodeKey;
        }
      }
    }

    const subscription = await this.subscriptionRepo.upsert({
      userId,
      mediaItemId,
      trigger,
      ...initialMarkers,
    });

    await this.actionRepo.create({
      userId,
      mediaItemId,
      action: USER_MEDIA_ACTION.SUBSCRIBE,
      context: context ?? null,
      reasonKey: reasonKey ?? null,
      payload: { trigger },
    });

    this.logger.log(`User ${userId} subscribed to ${trigger} for ${mediaItemId}`);
    return subscription;
  }

  /**
   * Gets current show state for initializing dedup markers.
   * Returns the last aired episode key (e.g., 'S2E5').
   * Only considers episodes with airDate <= now to exclude announced/future episodes.
   */
  private async getShowCurrentState(mediaItemId: string): Promise<ShowCurrentState | null> {
    try {
      // Get last aired episode (highest season + episode number with airDate <= now)
      const result = await this.db
        .select({
          seasonNumber: schema.seasons.number,
          episodeNumber: schema.episodes.number,
        })
        .from(schema.episodes)
        .innerJoin(schema.seasons, eq(schema.seasons.id, schema.episodes.seasonId))
        .innerJoin(schema.shows, eq(schema.shows.id, schema.seasons.showId))
        .where(
          and(
            eq(schema.shows.mediaItemId, mediaItemId),
            // Only aired episodes (airDate exists and is in the past)
            lte(schema.episodes.airDate, new Date()),
          ),
        )
        .orderBy(desc(schema.seasons.number), desc(schema.episodes.number))
        .limit(1);

      if (result.length === 0) {
        return { lastEpisodeKey: null };
      }

      const ep = result[0];
      const lastEpisodeKey = `S${ep.seasonNumber}E${ep.episodeNumber}`;

      return { lastEpisodeKey };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to get show state for ${mediaItemId}: ${msg}`);
      return null;
    }
  }

  /**
   * Unsubscribes from notifications and logs the action.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @param {SubscriptionTrigger} trigger - Trigger type
   * @param {string} context - Action context
   * @returns {Promise<boolean>} True if unsubscribed
   */
  async unsubscribe(
    userId: string,
    mediaItemId: string,
    trigger: SubscriptionTrigger,
    context?: string,
  ): Promise<boolean> {
    const deactivated = await this.subscriptionRepo.deactivate(userId, mediaItemId, trigger);

    if (deactivated) {
      await this.actionRepo.create({
        userId,
        mediaItemId,
        action: USER_MEDIA_ACTION.UNSUBSCRIBE,
        context: context ?? null,
        payload: { trigger },
      });
      this.logger.log(`User ${userId} unsubscribed from ${trigger} for ${mediaItemId}`);
    }

    return deactivated;
  }

  /**
   * Gets active triggers for a media item.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @returns {Promise<SubscriptionTrigger[]>} Active triggers
   */
  async getActiveTriggersForMedia(
    userId: string,
    mediaItemId: string,
  ): Promise<SubscriptionTrigger[]> {
    return this.subscriptionRepo.findActiveTriggersForMedia(userId, mediaItemId);
  }

  /**
   * Lists active subscriptions with media.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<{ total: number; data: SubscriptionWithMedia[] }>} Paginated result
   */
  async listActiveWithMedia(
    userId: string,
    limit = DEFAULT_PAGE_SIZE,
    offset = 0,
  ): Promise<{ total: number; data: SubscriptionWithMedia[] }> {
    const [total, data] = await Promise.all([
      this.subscriptionRepo.countActive(userId),
      this.subscriptionRepo.listActiveWithMedia(userId, limit, offset),
    ]);
    return { total, data };
  }

  /**
   * Auto-subscribes a user to new_season and new_episode notifications
   * for a show, respecting the user's `autoSubscribeOnWatch` preference.
   *
   * Skips triggers that are already active to avoid duplicates.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   */
  async autoSubscribeForShow(userId: string, mediaItemId: string): Promise<void> {
    const [[user], existing] = await Promise.all([
      this.db
        .select({ autoSubscribeOnWatch: schema.users.autoSubscribeOnWatch })
        .from(schema.users)
        .where(eq(schema.users.id, userId))
        .limit(1),
      this.subscriptionRepo.findActiveTriggersForMedia(userId, mediaItemId),
    ]);

    if (!user?.autoSubscribeOnWatch) return;

    const triggers = [SUBSCRIPTION_TRIGGER.NEW_SEASON, SUBSCRIPTION_TRIGGER.NEW_EPISODE] as const;
    for (const trigger of triggers) {
      if (!existing.includes(trigger)) {
        await this.subscribe({ userId, mediaItemId, trigger, context: 'auto-watch' });
      }
    }
  }
}
