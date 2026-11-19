import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { errorMessage } from '@/common/utils/error.utils';
import { ItemRemovedFromForLaterEvent } from '@/modules/user-actions/domain/events/item-removed-from-for-later.event';
import { USER_MEDIA_STATE, UserMediaStateChangedEvent } from '@/modules/user-media/public';

import { SubscriptionsService } from '../subscriptions.service';

@Injectable()
export class AutoUnsubscribeOnUnplanListener {
  private readonly logger = new Logger(AutoUnsubscribeOnUnplanListener.name);

  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @OnEvent(UserMediaStateChangedEvent.eventName)
  async onStateChanged(event: UserMediaStateChangedEvent): Promise<void> {
    const leftPlanned =
      event.previousState === USER_MEDIA_STATE.PLANNED &&
      event.newState !== USER_MEDIA_STATE.PLANNED;
    if (!leftPlanned) return;
    await this.unsubscribe(event.userId, event.mediaItemId);
  }

  @OnEvent(ItemRemovedFromForLaterEvent.eventName)
  async onRemovedFromForLater(event: ItemRemovedFromForLaterEvent): Promise<void> {
    await this.unsubscribe(event.userId, event.mediaItemId);
  }

  private async unsubscribe(userId: string, mediaItemId: string): Promise<void> {
    try {
      await this.subscriptionsService.unsubscribeAbandonedAutoPlan(userId, mediaItemId);
    } catch (error) {
      this.logger.warn(
        `Auto-plan unsubscribe failed: user=${userId}, media=${mediaItemId}: ${errorMessage(error)}`,
      );
    }
  }
}
