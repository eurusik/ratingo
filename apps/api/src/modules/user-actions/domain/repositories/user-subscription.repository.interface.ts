import { UserSubscription, SubscriptionTrigger } from '../entities/user-subscription.entity';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { ImageDto } from '../../../catalog/presentation/dtos/common.dto';

/**
 * Injection token for user subscription repository.
 */
export const USER_SUBSCRIPTION_REPOSITORY = Symbol('USER_SUBSCRIPTION_REPOSITORY');

/**
 * Payload for upserting a subscription.
 */
export interface UpsertSubscriptionData {
  userId: string;
  mediaItemId: string;
  trigger: SubscriptionTrigger;
  channel?: string;
}

/**
 * Subscription with media summary for list display.
 */
export interface SubscriptionWithMedia extends UserSubscription {
  mediaSummary: {
    id: string;
    type: MediaType;
    title: string;
    slug: string;
    poster: ImageDto | null;
    releaseDate?: Date | null;
  };
}

/**
 * Repository contract for user subscription operations.
 */
export interface IUserSubscriptionRepository {
  /**
   * Upserts a subscription (activates if exists).
   *
   * @param {UpsertSubscriptionData} data - Upsert payload
   * @returns {Promise<UserSubscription>} Persisted subscription
   */
  upsert(data: UpsertSubscriptionData): Promise<UserSubscription>;

  /**
   * Deactivates a subscription.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @param {SubscriptionTrigger} trigger - Trigger type
   * @returns {Promise<boolean>} True if deactivated
   */
  deactivate(userId: string, mediaItemId: string, trigger: SubscriptionTrigger): Promise<boolean>;

  /**
   * Finds an active subscription.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @param {SubscriptionTrigger} trigger - Trigger type
   * @returns {Promise<UserSubscription | null>} Subscription or null
   */
  findOne(
    userId: string,
    mediaItemId: string,
    trigger: SubscriptionTrigger,
  ): Promise<UserSubscription | null>;

  /**
   * Gets active triggers for a media item.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @returns {Promise<SubscriptionTrigger[]>} Active triggers
   */
  findActiveTriggersForMedia(userId: string, mediaItemId: string): Promise<SubscriptionTrigger[]>;

  /**
   * Lists active subscriptions with media summary.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<SubscriptionWithMedia[]>} Subscriptions with media
   */
  listActiveWithMedia(
    userId: string,
    limit?: number,
    offset?: number,
  ): Promise<SubscriptionWithMedia[]>;

  /**
   * Counts active subscriptions.
   *
   * @param {string} userId - User identifier
   * @returns {Promise<number>} Count
   */
  countActive(userId: string): Promise<number>;

  /**
   * Marks subscription as notified.
   *
   * @param {string} subscriptionId - Subscription identifier
   * @returns {Promise<void>}
   */
  markNotified(subscriptionId: string): Promise<void>;

  /**
   * Finds TMDB IDs of shows that need tracking (have active subscriptions).
   * Filters: active subscription, show type, not ended/canceled, valid tmdbId.
   *
   * @returns {Promise<number[]>} Array of TMDB IDs
   */
  findTrackedShowTmdbIds(): Promise<number[]>;
}
