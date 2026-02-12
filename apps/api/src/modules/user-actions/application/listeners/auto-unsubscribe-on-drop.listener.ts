import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { UserMediaStateChangedEvent } from '../../../user-media/domain/events/user-media-state-changed.event';
import { SUBSCRIPTION_TRIGGER } from '../../domain/entities/user-subscription.entity';
import { SubscriptionsService } from '../subscriptions.service';

/**
 * Listens for user media state changes and auto-unsubscribes
 * from new_season / new_episode notifications when a show is dropped.
 *
 * Errors are caught and logged to prevent event handler failures
 * from propagating to the caller.
 */
@Injectable()
export class AutoUnsubscribeOnDropListener {
  private readonly logger = new Logger(AutoUnsubscribeOnDropListener.name);

  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @OnEvent(UserMediaStateChangedEvent.eventName)
  async handle(event: UserMediaStateChangedEvent): Promise<void> {
    if (event.newState !== 'dropped') return;

    try {
      await this.subscriptionsService.unsubscribe(
        event.userId,
        event.mediaItemId,
        SUBSCRIPTION_TRIGGER.NEW_SEASON,
        'auto-dropped',
      );
      await this.subscriptionsService.unsubscribe(
        event.userId,
        event.mediaItemId,
        SUBSCRIPTION_TRIGGER.NEW_EPISODE,
        'auto-dropped',
      );
      this.logger.log(
        `Auto-unsubscribed user=${event.userId} from media=${event.mediaItemId} (dropped)`,
      );
    } catch (error) {
      this.logger.warn(
        `Auto-unsubscribe failed: user=${event.userId}, media=${event.mediaItemId}`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}
