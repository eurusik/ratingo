import { Inject, Injectable, Logger } from '@nestjs/common';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { and, eq, inArray, or, isNull, ne, lt } from 'drizzle-orm';
import { DATABASE_CONNECTION } from '../../../database/database.module';
import * as schema from '../../../database/schema';
import {
  ShowSyncDiff,
  ShowSyncChanges,
} from '../../ingestion/domain/interfaces/show-sync-diff.interface';
import { SUBSCRIPTION_TRIGGER } from '../domain/entities/user-subscription.entity';

/**
 * Notification event to be emitted/processed.
 */
export interface SubscriptionNotificationEvent {
  subscriptionId: string;
  userId: string;
  mediaItemId: string;
  trigger: string;
  payload: {
    tmdbId: number;
    episodeKey?: string;
    seasonNumber?: number;
    airDate?: string;
    statusFrom?: string | null;
    statusTo?: string;
  };
}

/**
 * Service for handling show diff events and triggering notifications.
 * Implements dedup logic to prevent duplicate notifications.
 */
@Injectable()
export class SubscriptionTriggerService {
  private readonly logger = new Logger(SubscriptionTriggerService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Handles show sync diff and triggers notifications for affected subscriptions.
   * Implements dedup check using lastNotifiedEpisodeKey and lastNotifiedSeasonNumber.
   *
   * @param diff - Show sync diff with detected changes
   * @returns Array of notification events to be processed
   */
  async handleShowDiff(diff: ShowSyncDiff): Promise<SubscriptionNotificationEvent[]> {
    if (!diff.hasChanges) {
      return [];
    }

    const events: SubscriptionNotificationEvent[] = [];

    // Handle new episode
    if (diff.changes.newEpisode) {
      const episodeEvents = await this.handleNewEpisode(diff);
      events.push(...episodeEvents);
    }

    // Handle new season
    if (diff.changes.newSeason) {
      const seasonEvents = await this.handleNewSeason(diff);
      events.push(...seasonEvents);
    }

    // Handle status change (e.g., show ended)
    if (diff.changes.statusChanged) {
      await this.handleStatusChanged(diff);
    }

    this.logger.log(
      `Processed diff for show ${diff.tmdbId}: ${events.length} notifications generated`,
    );

    return events;
  }

  /**
   * Handles new episode change - notifies users with new_episode trigger.
   * Uses atomic update with condition to prevent duplicate notifications.
   */
  private async handleNewEpisode(diff: ShowSyncDiff): Promise<SubscriptionNotificationEvent[]> {
    const { newEpisode } = diff.changes;
    if (!newEpisode) return [];

    // Atomic update: only update subscriptions where marker is different
    // This prevents race conditions between workers/retries
    const updated = await this.db
      .update(schema.userSubscriptions)
      .set({
        lastNotifiedEpisodeKey: newEpisode.key,
        lastNotifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.userSubscriptions.mediaItemId, diff.mediaItemId),
          eq(schema.userSubscriptions.trigger, SUBSCRIPTION_TRIGGER.NEW_EPISODE),
          eq(schema.userSubscriptions.isActive, true),
          // Dedup condition: only update if marker is different or null
          or(
            isNull(schema.userSubscriptions.lastNotifiedEpisodeKey),
            ne(schema.userSubscriptions.lastNotifiedEpisodeKey, newEpisode.key),
          ),
        ),
      )
      .returning({
        id: schema.userSubscriptions.id,
        userId: schema.userSubscriptions.userId,
        mediaItemId: schema.userSubscriptions.mediaItemId,
      });

    // Generate events only for actually updated subscriptions
    const events: SubscriptionNotificationEvent[] = updated.map((sub) => ({
      subscriptionId: sub.id,
      userId: sub.userId,
      mediaItemId: sub.mediaItemId,
      trigger: SUBSCRIPTION_TRIGGER.NEW_EPISODE,
      payload: {
        tmdbId: diff.tmdbId,
        episodeKey: newEpisode.key,
        airDate: newEpisode.airDate,
      },
    }));

    if (events.length > 0) {
      this.logger.log(`New episode ${newEpisode.key}: ${events.length} subscriptions notified`);
    }

    return events;
  }

  /**
   * Handles new season change - notifies users with new_season trigger.
   * Uses atomic update with condition to prevent duplicate notifications.
   */
  private async handleNewSeason(diff: ShowSyncDiff): Promise<SubscriptionNotificationEvent[]> {
    const { newSeason } = diff.changes;
    if (!newSeason) return [];

    // Atomic update: only update subscriptions where season marker is lower
    // This prevents race conditions between workers/retries
    const updated = await this.db
      .update(schema.userSubscriptions)
      .set({
        lastNotifiedSeasonNumber: newSeason.seasonNumber,
        lastNotifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.userSubscriptions.mediaItemId, diff.mediaItemId),
          eq(schema.userSubscriptions.trigger, SUBSCRIPTION_TRIGGER.NEW_SEASON),
          eq(schema.userSubscriptions.isActive, true),
          // Dedup condition: only update if marker is null or lower than new season
          or(
            isNull(schema.userSubscriptions.lastNotifiedSeasonNumber),
            lt(schema.userSubscriptions.lastNotifiedSeasonNumber, newSeason.seasonNumber),
          ),
        ),
      )
      .returning({
        id: schema.userSubscriptions.id,
        userId: schema.userSubscriptions.userId,
        mediaItemId: schema.userSubscriptions.mediaItemId,
      });

    // Generate events only for actually updated subscriptions
    const events: SubscriptionNotificationEvent[] = updated.map((sub) => ({
      subscriptionId: sub.id,
      userId: sub.userId,
      mediaItemId: sub.mediaItemId,
      trigger: SUBSCRIPTION_TRIGGER.NEW_SEASON,
      payload: {
        tmdbId: diff.tmdbId,
        seasonNumber: newSeason.seasonNumber,
        airDate: newSeason.airDate,
      },
    }));

    if (events.length > 0) {
      this.logger.log(
        `New season ${newSeason.seasonNumber}: ${events.length} subscriptions notified`,
      );
    }

    return events;
  }

  /**
   * Handles status change - deactivates subscriptions if show ended/canceled.
   */
  private async handleStatusChanged(diff: ShowSyncDiff): Promise<void> {
    const { statusChanged } = diff.changes;
    if (!statusChanged) return;

    const endedStatuses = ['Ended', 'Canceled'];

    if (endedStatuses.includes(statusChanged.to)) {
      // Deactivate all subscriptions for this show
      const result = await this.db
        .update(schema.userSubscriptions)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.userSubscriptions.mediaItemId, diff.mediaItemId),
            eq(schema.userSubscriptions.isActive, true),
            inArray(schema.userSubscriptions.trigger, [
              SUBSCRIPTION_TRIGGER.NEW_SEASON,
              SUBSCRIPTION_TRIGGER.NEW_EPISODE,
            ]),
          ),
        )
        .returning({ id: schema.userSubscriptions.id });

      this.logger.log(
        `Deactivated ${result.length} subscriptions for show ${diff.tmdbId} (status: ${statusChanged.to})`,
      );
    }
  }
}
