import { Module } from '@nestjs/common';

import { DatabaseModule } from '../../database/database.module';

import { AutoResubscribeOnRestoreListener } from './application/listeners/auto-resubscribe-on-restore.listener';
import { AutoUnsubscribeOnDropListener } from './application/listeners/auto-unsubscribe-on-drop.listener';
import { NotificationsService } from './application/notifications.service';
import { SavedItemsService } from './application/saved-items.service';
import { SubscriptionTriggerService } from './application/subscription-trigger.service';
import { SubscriptionsService } from './application/subscriptions.service';
import { SHOW_STATE_PORT } from './domain/ports/show-state.port';
import { USER_PREFERENCE_PORT } from './domain/ports/user-preference.port';
import { USER_MEDIA_ACTION_REPOSITORY } from './domain/repositories/user-media-action.repository.interface';
import { USER_NOTIFICATION_REPOSITORY } from './domain/repositories/user-notification.repository.interface';
import { USER_SAVED_ITEM_REPOSITORY } from './domain/repositories/user-saved-item.repository.interface';
import { USER_SUBSCRIPTION_REPOSITORY } from './domain/repositories/user-subscription.repository.interface';
import { DrizzleShowStateAdapter } from './infrastructure/adapters/drizzle-show-state.adapter';
import { DrizzleUserPreferenceAdapter } from './infrastructure/adapters/drizzle-user-preference.adapter';
import { DrizzleUserMediaActionRepository } from './infrastructure/repositories/drizzle-user-media-action.repository';
import { DrizzleUserNotificationRepository } from './infrastructure/repositories/drizzle-user-notification.repository';
import { DrizzleUserSavedItemRepository } from './infrastructure/repositories/drizzle-user-saved-item.repository';
import { DrizzleUserSubscriptionRepository } from './infrastructure/repositories/drizzle-user-subscription.repository';
import { NotificationsController } from './presentation/controllers/notifications.controller';
import { SavedItemsController } from './presentation/controllers/saved-items.controller';
import { SubscriptionsController } from './presentation/controllers/subscriptions.controller';

/**
 * User Actions module - CTA Event Layer.
 *
 * Handles:
 * - Saved items (for_later, considering)
 * - Subscriptions (release, new_season, on_streaming notifications)
 * - Notifications (actual events triggered by subscriptions)
 * - Action event logging for analytics
 */
@Module({
  imports: [DatabaseModule],
  providers: [
    NotificationsService,
    SavedItemsService,
    SubscriptionsService,
    SubscriptionTriggerService,
    AutoUnsubscribeOnDropListener,
    AutoResubscribeOnRestoreListener,
    {
      provide: USER_MEDIA_ACTION_REPOSITORY,
      useClass: DrizzleUserMediaActionRepository,
    },
    {
      provide: USER_NOTIFICATION_REPOSITORY,
      useClass: DrizzleUserNotificationRepository,
    },
    {
      provide: USER_SAVED_ITEM_REPOSITORY,
      useClass: DrizzleUserSavedItemRepository,
    },
    {
      provide: USER_SUBSCRIPTION_REPOSITORY,
      useClass: DrizzleUserSubscriptionRepository,
    },
    {
      provide: SHOW_STATE_PORT,
      useClass: DrizzleShowStateAdapter,
    },
    {
      provide: USER_PREFERENCE_PORT,
      useClass: DrizzleUserPreferenceAdapter,
    },
  ],
  controllers: [NotificationsController, SavedItemsController, SubscriptionsController],
  exports: [
    NotificationsService,
    SavedItemsService,
    SubscriptionsService,
    SubscriptionTriggerService,
    USER_SUBSCRIPTION_REPOSITORY,
  ],
})
export class UserActionsModule {}
