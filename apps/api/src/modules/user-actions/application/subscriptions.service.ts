import { Inject, Injectable, Logger } from '@nestjs/common';

import { DEFAULT_PAGE_SIZE } from '@/common/constants';
import { startOfUtcDay } from '@/common/utils/date.util';
import { parseSeasonFromEpisodeKey } from '@/modules/ingestion/public';
import { CLOCK_PORT, type IClockPort } from '@/modules/shared/clock';
import { isAwaitingPremiere } from '@/modules/shared/show-premiere';

import { SUBSCRIPTION_CONTEXT } from '../domain/constants/subscription.constants';
import { type UserSubscription, type SubscriptionTrigger } from '../domain/entities';
import { USER_MEDIA_ACTION } from '../domain/entities/user-media-action.entity';
import { SUBSCRIPTION_TRIGGER } from '../domain/entities/user-subscription.entity';
import { type IMovieReleasePort, MOVIE_RELEASE_PORT } from '../domain/ports/movie-release.port';
import { type IShowStatePort, SHOW_STATE_PORT } from '../domain/ports/show-state.port';
import {
  type IUserPreferencePort,
  USER_PREFERENCE_PORT,
} from '../domain/ports/user-preference.port';
import {
  type IUserMediaActionRepository,
  USER_MEDIA_ACTION_REPOSITORY,
} from '../domain/repositories/user-media-action.repository.interface';
import {
  type IUserSubscriptionRepository,
  USER_SUBSCRIPTION_REPOSITORY,
  type SubscriptionWithMedia,
} from '../domain/repositories/user-subscription.repository.interface';

import { pendingMovieReleaseTriggers } from './movie-release-triggers';

export interface SubscribePayload {
  userId: string;
  mediaItemId: string;
  trigger: SubscriptionTrigger;
  context?: string;
  reasonKey?: string;
}

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  constructor(
    @Inject(USER_SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepo: IUserSubscriptionRepository,
    @Inject(USER_MEDIA_ACTION_REPOSITORY)
    private readonly actionRepo: IUserMediaActionRepository,
    @Inject(SHOW_STATE_PORT)
    private readonly showStatePort: IShowStatePort,
    @Inject(USER_PREFERENCE_PORT)
    private readonly userPreferencePort: IUserPreferencePort,
    @Inject(MOVIE_RELEASE_PORT)
    private readonly movieReleasePort: IMovieReleasePort,
    @Inject(CLOCK_PORT)
    private readonly clock: IClockPort,
  ) {}

  async subscribe(payload: SubscribePayload): Promise<UserSubscription> {
    const { userId, mediaItemId, trigger, context, reasonKey } = payload;

    const initialMarkers: {
      lastNotifiedSeasonNumber?: number | null;
      lastNotifiedEpisodeKey?: string | null;
      knownPremiereDate?: Date | null;
    } = {};

    if (
      trigger === SUBSCRIPTION_TRIGGER.NEW_SEASON ||
      trigger === SUBSCRIPTION_TRIGGER.NEW_EPISODE ||
      trigger === SUBSCRIPTION_TRIGGER.PREMIERE
    ) {
      const lastEpisodeKey = await this.showStatePort.getLastAiredEpisodeKey(mediaItemId);
      const airedSeason = parseSeasonFromEpisodeKey(lastEpisodeKey) ?? 0;

      if (trigger === SUBSCRIPTION_TRIGGER.NEW_SEASON) {
        initialMarkers.lastNotifiedSeasonNumber = airedSeason;
      }
      if (trigger !== SUBSCRIPTION_TRIGGER.NEW_SEASON) {
        initialMarkers.lastNotifiedEpisodeKey = lastEpisodeKey;
      }
    }

    if (trigger === SUBSCRIPTION_TRIGGER.PREMIERE) {
      initialMarkers.knownPremiereDate = await this.knownPremiereDateOf(mediaItemId);
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

  async getActiveTriggersForMedia(
    userId: string,
    mediaItemId: string,
  ): Promise<SubscriptionTrigger[]> {
    return this.subscriptionRepo.findActiveTriggersForMedia(userId, mediaItemId);
  }

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

  async autoSubscribeForShow(userId: string, mediaItemId: string): Promise<void> {
    const [autoSubscribe, existing] = await Promise.all([
      this.userPreferencePort.getAutoSubscribeOnWatch(userId),
      this.subscriptionRepo.findActiveTriggersForMedia(userId, mediaItemId),
    ]);

    if (!autoSubscribe) return;

    const triggers = [SUBSCRIPTION_TRIGGER.NEW_SEASON, SUBSCRIPTION_TRIGGER.NEW_EPISODE] as const;
    for (const trigger of triggers) {
      if (!existing.includes(trigger)) {
        await this.subscribe({
          userId,
          mediaItemId,
          trigger,
          context: SUBSCRIPTION_CONTEXT.AUTO_WATCH,
        });
      }
    }
  }

  async autoSubscribeForMovie(userId: string, mediaItemId: string): Promise<void> {
    const schedule = await this.movieReleasePort.findMovieReleaseSchedule(mediaItemId);
    if (!schedule) return;

    const today = startOfUtcDay(this.clock.now());
    await this.subscribeForPlan(userId, mediaItemId, pendingMovieReleaseTriggers(schedule, today));
  }

  async autoSubscribeForPremiere(userId: string, mediaItemId: string): Promise<void> {
    const now = this.clock.now();
    const facts = await this.showStatePort.findShowPremiereFacts(mediaItemId, now);
    if (!facts || !isAwaitingPremiere(facts, now)) return;

    await this.subscribeForPlan(
      userId,
      mediaItemId,
      [SUBSCRIPTION_TRIGGER.PREMIERE],
      facts.firstAirDate,
    );
  }

  private async knownPremiereDateOf(mediaItemId: string): Promise<Date | null> {
    const facts = await this.showStatePort.findShowPremiereFacts(mediaItemId, this.clock.now());
    return facts?.firstAirDate ?? null;
  }

  private async subscribeForPlan(
    userId: string,
    mediaItemId: string,
    triggers: SubscriptionTrigger[],
    knownPremiereDate: Date | null = null,
  ): Promise<void> {
    if (triggers.length === 0) return;

    const [autoSubscribe, closedTriggers] = await Promise.all([
      this.userPreferencePort.getAutoSubscribeOnWatch(userId),
      this.subscriptionRepo.findTriggersClosedToAutoPlan(userId, mediaItemId),
    ]);
    if (!autoSubscribe) return;

    for (const trigger of triggers.filter((candidate) => !closedTriggers.includes(candidate))) {
      const activated = await this.subscriptionRepo.activateAutoPlan({
        userId,
        mediaItemId,
        trigger,
        knownPremiereDate,
      });
      if (!activated) continue;
      await this.actionRepo.create({
        userId,
        mediaItemId,
        action: USER_MEDIA_ACTION.SUBSCRIBE,
        context: SUBSCRIPTION_CONTEXT.AUTO_PLAN,
        payload: { trigger },
      });
    }
  }

  async unsubscribeAbandonedAutoPlan(userId: string, mediaItemId: string): Promise<void> {
    const triggers = await this.subscriptionRepo.deactivateAbandonedAutoPlan(userId, mediaItemId);
    for (const trigger of triggers) {
      await this.actionRepo.create({
        userId,
        mediaItemId,
        action: USER_MEDIA_ACTION.UNSUBSCRIBE,
        context: SUBSCRIPTION_CONTEXT.AUTO_PLAN,
        payload: { trigger },
      });
    }
    if (triggers.length > 0) {
      this.logger.log(
        `User ${userId} no longer plans ${mediaItemId}, unsubscribed from ${triggers.join(', ')}`,
      );
    }
  }
}
