import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { USER_MEDIA_STATE } from '../../../user-media/domain/entities/user-media-state.entity';
import { UserMediaStateChangedEvent } from '../../../user-media/domain/events/user-media-state-changed.event';
import { SubscriptionsService } from '../subscriptions.service';

@Injectable()
export class AutoResubscribeOnRestoreListener {
  private readonly logger = new Logger(AutoResubscribeOnRestoreListener.name);

  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @OnEvent(UserMediaStateChangedEvent.eventName)
  async handle(event: UserMediaStateChangedEvent): Promise<void> {
    if (
      event.newState !== USER_MEDIA_STATE.WATCHING ||
      event.previousState !== USER_MEDIA_STATE.DROPPED
    )
      return;

    try {
      await this.subscriptionsService.autoSubscribeForShow(event.userId, event.mediaItemId);
      this.logger.log(
        `Auto-resubscribed user=${event.userId} to media=${event.mediaItemId} (restored from dropped)`,
      );
    } catch (error) {
      this.logger.warn(
        `Auto-resubscribe failed: user=${event.userId}, media=${event.mediaItemId}`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}
