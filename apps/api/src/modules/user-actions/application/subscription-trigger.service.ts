import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { ShowStatus } from '@/common/enums/show-status.enum';
import { addUtcDays, startOfUtcDay } from '@/common/utils/date.util';
import { errorMessage } from '@/common/utils/error.utils';
import {
  findReleaseCountry,
  MovieReleaseDateKind,
  resolveMovieRelease,
} from '@/modules/catalog/public';
import type { ShowSyncDiff } from '@/modules/ingestion/public';
import { CLOCK_PORT, type IClockPort } from '@/modules/shared/clock';

import { SHOW_EVENTS } from '../domain/constants/events.constants';
import { MOVIE_RELEASE_NOTIFY_WINDOW_DAYS } from '../domain/constants/subscription.constants';
import {
  NOTIFICATION_RELEASE_KIND,
  type NotificationReleaseKind,
} from '../domain/entities/user-notification.entity';
import { SUBSCRIPTION_TRIGGER } from '../domain/entities/user-subscription.entity';
import {
  type IUserNotificationRepository,
  USER_NOTIFICATION_REPOSITORY,
} from '../domain/repositories/user-notification.repository.interface';
import {
  type ClaimedMovieRelease,
  type IUserSubscriptionRepository,
  type MovieReleaseTrigger,
  type ReleaseDayWindow,
  USER_SUBSCRIPTION_REPOSITORY,
} from '../domain/repositories/user-subscription.repository.interface';

export interface SubscriptionNotificationEvent {
  subscriptionId: string;
  userId: string;
  mediaItemId: string;
  trigger: string;
  payload: {
    tmdbId?: number;
    episodeKey?: string;
    seasonNumber?: number;
    airDate?: string;
    statusFrom?: string | null;
    statusTo?: string;
    releaseKind?: NotificationReleaseKind;
    releaseCountry?: string | null;
  };
}

interface MovieReleaseNotice {
  airDate: string;
  releaseKind: NotificationReleaseKind;
  releaseCountry: string | null;
}

const MOVIE_RELEASE_TRIGGERS: readonly MovieReleaseTrigger[] = [
  SUBSCRIPTION_TRIGGER.ON_STREAMING,
  SUBSCRIPTION_TRIGGER.RELEASE,
];

@Injectable()
export class SubscriptionTriggerService {
  private readonly logger = new Logger(SubscriptionTriggerService.name);

  constructor(
    @Inject(USER_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepo: IUserSubscriptionRepository,
    @Inject(USER_NOTIFICATION_REPOSITORY)
    private readonly notificationRepo: IUserNotificationRepository,
    private readonly eventEmitter: EventEmitter2,
    @Inject(CLOCK_PORT)
    private readonly clock: IClockPort,
  ) {}

  async notifyMovieReleases(): Promise<SubscriptionNotificationEvent[]> {
    const window = this.movieReleaseWindow();
    const events: SubscriptionNotificationEvent[] = [];

    for (const trigger of MOVIE_RELEASE_TRIGGERS) {
      events.push(...(await this.notifyClaimedMovieReleases(trigger, window)));
    }

    this.logger.log(
      `Movie releases from ${window.from.toISOString()}: ${events.length} notifications generated`,
    );
    return events;
  }

  private async notifyClaimedMovieReleases(
    trigger: MovieReleaseTrigger,
    window: ReleaseDayWindow,
  ): Promise<SubscriptionNotificationEvent[]> {
    const claimed = await this.subscriptionRepo.claimMovieReleases(trigger, window);
    const events = claimed.flatMap((release) => this.toMovieReleaseEvent(trigger, release));
    if (events.length === 0) return events;

    try {
      await this.persistNotifications(events);
    } catch (error) {
      await this.subscriptionRepo.releaseClaims(events.map((event) => event.subscriptionId));
      throw error;
    }
    return events;
  }

  private movieReleaseWindow(): ReleaseDayWindow {
    const today = startOfUtcDay(this.clock.now());
    return {
      from: addUtcDays(today, -MOVIE_RELEASE_NOTIFY_WINDOW_DAYS),
      toExclusive: addUtcDays(today, 1),
    };
  }

  private toMovieReleaseEvent(
    trigger: MovieReleaseTrigger,
    release: ClaimedMovieRelease,
  ): SubscriptionNotificationEvent[] {
    const notice = this.buildReleaseNotice(trigger, release);
    if (!notice) {
      this.logger.error(`Claimed ${trigger} subscription ${release.id} without a release date`);
      return [];
    }
    return [
      {
        subscriptionId: release.id,
        userId: release.userId,
        mediaItemId: release.mediaItemId,
        trigger,
        payload: notice,
      },
    ];
  }

  private buildReleaseNotice(
    trigger: MovieReleaseTrigger,
    release: ClaimedMovieRelease,
  ): MovieReleaseNotice | null {
    if (trigger === SUBSCRIPTION_TRIGGER.ON_STREAMING) {
      if (!release.digitalReleaseDate) return null;
      const digital = { date: release.digitalReleaseDate, kind: MovieReleaseDateKind.DIGITAL };
      return {
        airDate: release.digitalReleaseDate.toISOString(),
        releaseKind: NOTIFICATION_RELEASE_KIND.DIGITAL,
        releaseCountry: findReleaseCountry(digital, release.releases ?? []),
      };
    }
    const resolved = resolveMovieRelease(release, release.releases);
    if (!resolved) return null;
    return {
      airDate: resolved.date.toISOString(),
      releaseKind: resolved.kind,
      releaseCountry: resolved.country,
    };
  }

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

  /**
   * Persists notifications for subscriptions whose dedup markers were ALREADY advanced
   * by atomicNotify* (a separate UPDATE ... RETURNING).
   *
   * Ideally marker advance + insert would share one DB transaction, but user-actions has
   * no transaction abstraction (the only one lives in catalog's domain and cross-module
   * imports are barrel-only), so failures are logged and RETHROWN: the caller/job sees the
   * failure instead of the notifications silently disappearing.
   */
  private async persistNotifications(events: SubscriptionNotificationEvent[]): Promise<void> {
    try {
      const notificationData = events.map((event) => ({
        userId: event.userId,
        mediaItemId: event.mediaItemId,
        subscriptionId: event.subscriptionId,
        trigger: event.trigger as
          'release' | 'new_season' | 'new_episode' | 'on_streaming' | 'status_changed',
        payload: {
          seasonNumber: event.payload.seasonNumber,
          episodeKey: event.payload.episodeKey,
          airDate: event.payload.airDate,
          releaseKind: event.payload.releaseKind,
          releaseCountry: event.payload.releaseCountry,
        },
      }));

      const created = await this.notificationRepo.createMany(notificationData);
      this.logger.log(`Persisted ${created} notifications to database`);
    } catch (error) {
      const msg = errorMessage(error);
      this.logger.error(
        `Failed to persist ${events.length} notifications (dedup markers already advanced): ${msg}`,
      );
      throw error;
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

    // Emit whenever the sync diff reports a new episode — independent of subscribers.
    // caught_up users may have no (or an inactive) subscription (e.g. unsubscribed, or
    // dropped→restored) and must still move back to watching. The listener is an idempotent
    // bulk UPDATE of caught_up rows and is a no-op when nobody matches.
    this.eventEmitter.emit(SHOW_EVENTS.NEW_EPISODE, { mediaItemId: diff.mediaItemId });

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
