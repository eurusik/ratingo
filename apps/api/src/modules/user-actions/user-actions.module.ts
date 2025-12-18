import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';

import { USER_MEDIA_ACTION_REPOSITORY } from './domain/repositories/user-media-action.repository.interface';
import { USER_SAVED_ITEM_REPOSITORY } from './domain/repositories/user-saved-item.repository.interface';
import { USER_SUBSCRIPTION_REPOSITORY } from './domain/repositories/user-subscription.repository.interface';

import { DrizzleUserMediaActionRepository } from './infrastructure/repositories/drizzle-user-media-action.repository';
import { DrizzleUserSavedItemRepository } from './infrastructure/repositories/drizzle-user-saved-item.repository';
import { DrizzleUserSubscriptionRepository } from './infrastructure/repositories/drizzle-user-subscription.repository';

import { SavedItemsService } from './application/saved-items.service';
import { SubscriptionsService } from './application/subscriptions.service';

import { SavedItemsController } from './presentation/controllers/saved-items.controller';
import { SubscriptionsController } from './presentation/controllers/subscriptions.controller';

/**
 * User Actions module - CTA Event Layer.
 *
 * Handles:
 * - Saved items (for_later, considering)
 * - Subscriptions (release, new_season, on_streaming notifications)
 * - Action event logging for analytics
 */
@Module({
  imports: [DatabaseModule, forwardRef(() => AuthModule)],
  providers: [
    SavedItemsService,
    SubscriptionsService,
    {
      provide: USER_MEDIA_ACTION_REPOSITORY,
      useClass: DrizzleUserMediaActionRepository,
    },
    {
      provide: USER_SAVED_ITEM_REPOSITORY,
      useClass: DrizzleUserSavedItemRepository,
    },
    {
      provide: USER_SUBSCRIPTION_REPOSITORY,
      useClass: DrizzleUserSubscriptionRepository,
    },
  ],
  controllers: [SavedItemsController, SubscriptionsController],
  exports: [SavedItemsService, SubscriptionsService],
})
export class UserActionsModule {}
