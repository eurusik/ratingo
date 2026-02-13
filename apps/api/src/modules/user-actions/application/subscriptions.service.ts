import { Inject, Injectable, Logger } from '@nestjs/common';

import { DEFAULT_PAGE_SIZE } from '@/common/constants';

import { parseSeasonFromEpisodeKey } from '../../ingestion/public';
import { SUBSCRIPTION_CONTEXT } from '../domain/constants/subscription.constants';
import { type UserSubscription, type SubscriptionTrigger } from '../domain/entities';
import { USER_MEDIA_ACTION } from '../domain/entities/user-media-action.entity';
import { SUBSCRIPTION_TRIGGER } from '../domain/entities/user-subscription.entity';
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
  ) {}

  async subscribe(payload: SubscribePayload): Promise<UserSubscription> {
    const { userId, mediaItemId, trigger, context, reasonKey } = payload;

    const initialMarkers: {
      lastNotifiedSeasonNumber?: number | null;
      lastNotifiedEpisodeKey?: string | null;
    } = {};

    if (
      trigger === SUBSCRIPTION_TRIGGER.NEW_SEASON ||
      trigger === SUBSCRIPTION_TRIGGER.NEW_EPISODE
    ) {
      const lastEpisodeKey = await this.showStatePort.getLastAiredEpisodeKey(mediaItemId);
      const airedSeason = parseSeasonFromEpisodeKey(lastEpisodeKey) ?? 0;

      if (trigger === SUBSCRIPTION_TRIGGER.NEW_SEASON) {
        initialMarkers.lastNotifiedSeasonNumber = airedSeason;
      }
      if (trigger === SUBSCRIPTION_TRIGGER.NEW_EPISODE) {
        initialMarkers.lastNotifiedEpisodeKey = lastEpisodeKey;
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
}
