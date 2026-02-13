import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { USER_MEDIA_STATE } from '../../../user-media/domain/entities/user-media-state.entity';
import { UserMediaStateChangedEvent } from '../../../user-media/domain/events/user-media-state-changed.event';
import { SUBSCRIPTION_CONTEXT } from '../../domain/constants/subscription.constants';
import { SUBSCRIPTION_TRIGGER } from '../../domain/entities/user-subscription.entity';
import { SubscriptionsService } from '../subscriptions.service';

@Injectable()
export class AutoUnsubscribeOnDropListener {
  private readonly logger = new Logger(AutoUnsubscribeOnDropListener.name);

  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @OnEvent(UserMediaStateChangedEvent.eventName)
  async handle(event: UserMediaStateChangedEvent): Promise<void> {
    if (event.newState !== USER_MEDIA_STATE.DROPPED) return;

    try {
      await Promise.all([
        this.subscriptionsService.unsubscribe(
          event.userId,
          event.mediaItemId,
          SUBSCRIPTION_TRIGGER.NEW_SEASON,
          SUBSCRIPTION_CONTEXT.AUTO_DROPPED,
        ),
        this.subscriptionsService.unsubscribe(
          event.userId,
          event.mediaItemId,
          SUBSCRIPTION_TRIGGER.NEW_EPISODE,
          SUBSCRIPTION_CONTEXT.AUTO_DROPPED,
        ),
      ]);
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
