import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { errorMessage } from '@/common/utils/error.utils';
import { ItemSavedForLaterEvent } from '@/modules/user-actions/domain/events/item-saved-for-later.event';
import { USER_MEDIA_STATE, UserMediaStateChangedEvent } from '@/modules/user-media/public';

import { SubscriptionsService } from '../subscriptions.service';

@Injectable()
export class AutoSubscribeOnPlanListener {
  private readonly logger = new Logger(AutoSubscribeOnPlanListener.name);

  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @OnEvent(UserMediaStateChangedEvent.eventName)
  async onStateChanged(event: UserMediaStateChangedEvent): Promise<void> {
    if (event.newState !== USER_MEDIA_STATE.PLANNED) return;
    await this.subscribe(event.userId, event.mediaItemId);
  }

  @OnEvent(ItemSavedForLaterEvent.eventName)
  async onSavedForLater(event: ItemSavedForLaterEvent): Promise<void> {
    await this.subscribe(event.userId, event.mediaItemId);
  }

  private async subscribe(userId: string, mediaItemId: string): Promise<void> {
    const target = `user=${userId}, media=${mediaItemId}`;
    await this.attempt(`Movie auto-subscribe failed: ${target}`, () =>
      this.subscriptionsService.autoSubscribeForMovie(userId, mediaItemId),
    );
    await this.attempt(`Upcoming show auto-subscribe failed: ${target}`, () =>
      this.subscriptionsService.autoSubscribeForUpcomingShow(userId, mediaItemId),
    );
  }

  private async attempt(failure: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (error) {
      this.logger.warn(`${failure}: ${errorMessage(error)}`);
    }
  }
}
