/**
 * Public API for user-actions module.
 *
 * This is the ONLY entry point for other modules to import from user-actions.
 *
 * @example
 * // ✅ Correct
 * import { SubscriptionTriggerService, USER_SUBSCRIPTION_REPOSITORY } from '../user-actions/public';
 *
 * // ❌ Wrong - breaks module boundaries
 * import { SubscriptionTriggerService } from '../user-actions/application/subscription-trigger.service';
 */

// Services (for cross-module use)
export { SubscriptionTriggerService } from '../application/subscription-trigger.service';

// Repository interfaces and tokens
export {
  type IUserSubscriptionRepository,
  USER_SUBSCRIPTION_REPOSITORY,
} from '../domain/repositories/user-subscription.repository.interface';

// Entity types
export type { SubscriptionTrigger } from '../domain/entities/user-subscription.entity';
export { SUBSCRIPTION_TRIGGER } from '../domain/entities/user-subscription.entity';

// Module
export { UserActionsModule } from '../user-actions.module';
