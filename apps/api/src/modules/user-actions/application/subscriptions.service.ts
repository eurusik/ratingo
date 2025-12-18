import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IUserSubscriptionRepository,
  USER_SUBSCRIPTION_REPOSITORY,
  SubscriptionWithMedia,
} from '../domain/repositories/user-subscription.repository.interface';
import {
  IUserMediaActionRepository,
  USER_MEDIA_ACTION_REPOSITORY,
} from '../domain/repositories/user-media-action.repository.interface';
import { UserSubscription, SubscriptionTrigger } from '../domain/entities';
import { USER_MEDIA_ACTION } from '../domain/entities/user-media-action.entity';

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
  ) {}

  /**
   * Subscribes to notifications and logs the action.
   *
   * @param {SubscribePayload} payload - Subscribe payload
   * @returns {Promise<UserSubscription>} Subscription
   */
  async subscribe(payload: SubscribePayload): Promise<UserSubscription> {
    const { userId, mediaItemId, trigger, context, reasonKey } = payload;

    const subscription = await this.subscriptionRepo.upsert({ userId, mediaItemId, trigger });

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
    limit = 20,
    offset = 0,
  ): Promise<{ total: number; data: SubscriptionWithMedia[] }> {
    const [total, data] = await Promise.all([
      this.subscriptionRepo.countActive(userId),
      this.subscriptionRepo.listActiveWithMedia(userId, limit, offset),
    ]);
    return { total, data };
  }
}
