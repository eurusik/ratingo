import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { apiOnly, workerOnly } from '@/common/runtime/app-role';
import schedulerConfig from '@/config/scheduler.config';
import { DatabaseModule } from '@/database/database.module';

import { AutoResubscribeOnRestoreListener } from './application/listeners/auto-resubscribe-on-restore.listener';
import { AutoSubscribeMovieOnPlanListener } from './application/listeners/auto-subscribe-movie-on-plan.listener';
import { AutoUnsubscribeOnDropListener } from './application/listeners/auto-unsubscribe-on-drop.listener';
import { AutoUnsubscribeOnUnplanListener } from './application/listeners/auto-unsubscribe-on-unplan.listener';
import { MovieReleaseNotificationsScheduler } from './application/movie-release-notifications.scheduler';
import { MovieReleaseNotifier } from './application/movie-release-notifier.service';
import { NotificationsService } from './application/notifications.service';
import { SavedItemsService } from './application/saved-items.service';
import { SubscriptionTriggerService } from './application/subscription-trigger.service';
import { SubscriptionsService } from './application/subscriptions.service';
import { UserNotificationsWorker } from './application/workers/user-notifications.worker';
import { MOVIE_RELEASE_PORT } from './domain/ports/movie-release.port';
import { SHOW_STATE_PORT } from './domain/ports/show-state.port';
import { USER_PREFERENCE_PORT } from './domain/ports/user-preference.port';
import { USER_MEDIA_ACTION_REPOSITORY } from './domain/repositories/user-media-action.repository.interface';
import { USER_NOTIFICATION_REPOSITORY } from './domain/repositories/user-notification.repository.interface';
import { USER_SAVED_ITEM_REPOSITORY } from './domain/repositories/user-saved-item.repository.interface';
import { USER_SUBSCRIPTION_REPOSITORY } from './domain/repositories/user-subscription.repository.interface';
import { DrizzleMovieReleaseAdapter } from './infrastructure/adapters/drizzle-movie-release.adapter';
import { DrizzleShowStateAdapter } from './infrastructure/adapters/drizzle-show-state.adapter';
import { DrizzleUserPreferenceAdapter } from './infrastructure/adapters/drizzle-user-preference.adapter';
import { AutoPlanSubscriptionsQuery } from './infrastructure/queries/auto-plan-subscriptions.query';
import { ClaimMovieReleasesQuery } from './infrastructure/queries/claim-movie-releases.query';
import { DrizzleUserMediaActionRepository } from './infrastructure/repositories/drizzle-user-media-action.repository';
import { DrizzleUserNotificationRepository } from './infrastructure/repositories/drizzle-user-notification.repository';
import { DrizzleUserSavedItemRepository } from './infrastructure/repositories/drizzle-user-saved-item.repository';
import { DrizzleUserSubscriptionRepository } from './infrastructure/repositories/drizzle-user-subscription.repository';
import { NotificationsController } from './presentation/controllers/notifications.controller';
import { SavedItemsController } from './presentation/controllers/saved-items.controller';
import { SubscriptionsController } from './presentation/controllers/subscriptions.controller';
import { USER_NOTIFICATIONS_JOB_OPTIONS, USER_NOTIFICATIONS_QUEUE } from './user-actions.constants';

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
  imports: [
    DatabaseModule,
    ConfigModule.forFeature(schedulerConfig),
    BullModule.registerQueue({
      name: USER_NOTIFICATIONS_QUEUE,
      defaultJobOptions: USER_NOTIFICATIONS_JOB_OPTIONS,
    }),
  ],
  providers: [
    NotificationsService,
    SavedItemsService,
    SubscriptionsService,
    SubscriptionTriggerService,
    MovieReleaseNotifier,
    ClaimMovieReleasesQuery,
    AutoPlanSubscriptionsQuery,
    ...workerOnly(UserNotificationsWorker, MovieReleaseNotificationsScheduler),
    AutoUnsubscribeOnDropListener,
    AutoResubscribeOnRestoreListener,
    AutoSubscribeMovieOnPlanListener,
    AutoUnsubscribeOnUnplanListener,
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
      provide: MOVIE_RELEASE_PORT,
      useClass: DrizzleMovieReleaseAdapter,
    },
    {
      provide: USER_PREFERENCE_PORT,
      useClass: DrizzleUserPreferenceAdapter,
    },
  ],
  controllers: apiOnly(NotificationsController, SavedItemsController, SubscriptionsController),
  exports: [
    NotificationsService,
    SavedItemsService,
    SubscriptionsService,
    SubscriptionTriggerService,
    USER_SUBSCRIPTION_REPOSITORY,
  ],
})
export class UserActionsModule {}
