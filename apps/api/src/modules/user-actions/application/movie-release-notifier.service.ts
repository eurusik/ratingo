import { Inject, Injectable, Logger } from '@nestjs/common';

import { addUtcDays, startOfUtcDay } from '@/common/utils/date.util';
import { errorMessage } from '@/common/utils/error.utils';
import { CLOCK_PORT, type IClockPort } from '@/modules/shared/clock';

import { MOVIE_RELEASE_NOTIFY_WINDOW_DAYS } from '../domain/constants/subscription.constants';
import { SUBSCRIPTION_TRIGGER } from '../domain/entities/user-subscription.entity';
import {
  type CreateNotificationData,
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

const MOVIE_RELEASE_TRIGGERS: readonly MovieReleaseTrigger[] = [
  SUBSCRIPTION_TRIGGER.ON_STREAMING,
  SUBSCRIPTION_TRIGGER.RELEASE,
];

@Injectable()
export class MovieReleaseNotifier {
  private readonly logger = new Logger(MovieReleaseNotifier.name);

  constructor(
    @Inject(USER_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepo: IUserSubscriptionRepository,
    @Inject(USER_NOTIFICATION_REPOSITORY)
    private readonly notificationRepo: IUserNotificationRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: IClockPort,
  ) {}

  async notifyMovieReleases(): Promise<number> {
    const window = this.releaseWindow();
    let notified = 0;
    for (const trigger of MOVIE_RELEASE_TRIGGERS) {
      notified += await this.notifyClaimedReleases(trigger, window);
    }
    this.logger.log(`Movie releases from ${window.from.toISOString()}: ${notified} notified`);
    return notified;
  }

  private releaseWindow(): ReleaseDayWindow {
    const today = startOfUtcDay(this.clock.now());
    return {
      from: addUtcDays(today, -MOVIE_RELEASE_NOTIFY_WINDOW_DAYS),
      toExclusive: addUtcDays(today, 1),
    };
  }

  private async notifyClaimedReleases(
    trigger: MovieReleaseTrigger,
    window: ReleaseDayWindow,
  ): Promise<number> {
    const claimed = await this.subscriptionRepo.claimMovieReleases(trigger, window);
    if (claimed.length === 0) return 0;

    try {
      await this.notificationRepo.createMany(
        claimed.map((release) => toNotification(trigger, release)),
      );
    } catch (error) {
      await this.handBackClaims(claimed);
      throw error;
    }
    return claimed.length;
  }

  private async handBackClaims(claimed: ClaimedMovieRelease[]): Promise<void> {
    try {
      await this.subscriptionRepo.releaseClaims(claimed.map((release) => release.id));
    } catch (error) {
      this.logger.error(
        `Could not hand back ${claimed.length} movie release claims, they stay notified: ${errorMessage(error)}`,
      );
    }
  }
}

function toNotification(
  trigger: MovieReleaseTrigger,
  { id, userId, mediaItemId, release }: ClaimedMovieRelease,
): CreateNotificationData {
  return {
    userId,
    mediaItemId,
    subscriptionId: id,
    trigger,
    payload: {
      airDate: release.releasedOn.toISOString(),
      releaseKind: release.kind,
      releaseCountry: release.country,
    },
  };
}
