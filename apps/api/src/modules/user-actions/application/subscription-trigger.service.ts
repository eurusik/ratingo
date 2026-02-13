import { Inject, Injectable, Logger } from '@nestjs/common';

import { ShowStatus } from '../../../common/enums/show-status.enum';
import type { ShowSyncDiff } from '../../ingestion/public';
import { SUBSCRIPTION_TRIGGER } from '../domain/entities/user-subscription.entity';
import {
  type IUserNotificationRepository,
  USER_NOTIFICATION_REPOSITORY,
} from '../domain/repositories/user-notification.repository.interface';
import {
  type IUserSubscriptionRepository,
  USER_SUBSCRIPTION_REPOSITORY,
} from '../domain/repositories/user-subscription.repository.interface';

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

@Injectable()
export class SubscriptionTriggerService {
  private readonly logger = new Logger(SubscriptionTriggerService.name);

  constructor(
    @Inject(USER_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepo: IUserSubscriptionRepository,
    @Inject(USER_NOTIFICATION_REPOSITORY)
    private readonly notificationRepo: IUserNotificationRepository,
  ) {}

  async handleShowDiff(diff: ShowSyncDiff): Promise<SubscriptionNotificationEvent[]> {
    if (!diff.hasChanges) {
      return [];
    }

    const events: SubscriptionNotificationEvent[] = [];

    if (diff.changes.newEpisode) {
      const episodeEvents = await this.handleNewEpisode(diff);
      events.push(...episodeEvents);
    }

    if (diff.changes.newSeason) {
      const seasonEvents = await this.handleNewSeason(diff);
      events.push(...seasonEvents);
    }

    if (diff.changes.statusChanged) {
      await this.handleStatusChanged(diff);
    }

    if (events.length > 0) {
      await this.persistNotifications(events);
    }

    this.logger.log(
      `Processed diff for show ${diff.tmdbId}: ${events.length} notifications generated`,
    );

    return events;
  }

  private async persistNotifications(events: SubscriptionNotificationEvent[]): Promise<void> {
    try {
      const notificationData = events.map((event) => ({
        userId: event.userId,
        mediaItemId: event.mediaItemId,
        subscriptionId: event.subscriptionId,
        trigger: event.trigger as
          | 'release'
          | 'new_season'
          | 'new_episode'
          | 'on_streaming'
          | 'status_changed',
        payload: {
          seasonNumber: event.payload.seasonNumber,
          episodeKey: event.payload.episodeKey,
          airDate: event.payload.airDate,
        },
      }));

      const created = await this.notificationRepo.createMany(notificationData);
      this.logger.log(`Persisted ${created} notifications to database`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to persist notifications: ${msg}`);
    }
  }

  private async handleNewEpisode(diff: ShowSyncDiff): Promise<SubscriptionNotificationEvent[]> {
    const { newEpisode } = diff.changes;
    if (!newEpisode) return [];

    const updated = await this.subscriptionRepo.atomicNotifyNewEpisode(
      diff.mediaItemId,
      newEpisode.key,
    );

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

  private async handleNewSeason(diff: ShowSyncDiff): Promise<SubscriptionNotificationEvent[]> {
    const { newSeason } = diff.changes;
    if (!newSeason) return [];

    const updated = await this.subscriptionRepo.atomicNotifyNewSeason(
      diff.mediaItemId,
      newSeason.seasonNumber,
    );

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

  private async handleStatusChanged(diff: ShowSyncDiff): Promise<void> {
    const { statusChanged } = diff.changes;
    if (!statusChanged) return;

    const isTerminal =
      statusChanged.to === ShowStatus.ENDED || statusChanged.to === ShowStatus.CANCELED;

    if (isTerminal) {
      const count = await this.subscriptionRepo.deactivateForEndedShow(diff.mediaItemId);
      this.logger.log(
        `Deactivated ${count} subscriptions for show ${diff.tmdbId} (status: ${statusChanged.to})`,
      );
    }
  }
}
