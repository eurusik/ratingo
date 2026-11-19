import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { errorMessage } from '@/common/utils/error.utils';
import { ItemSavedForLaterEvent } from '@/modules/user-actions/domain/events/item-saved-for-later.event';
import { USER_MEDIA_STATE, UserMediaStateChangedEvent } from '@/modules/user-media/public';

import { SubscriptionsService } from '../subscriptions.service';

@Injectable()
export class AutoSubscribeMovieOnPlanListener {
  private readonly logger = new Logger(AutoSubscribeMovieOnPlanListener.name);

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
    try {
      await this.subscriptionsService.autoSubscribeForMovie(userId, mediaItemId);
    } catch (error) {
      this.logger.warn(
        `Movie auto-subscribe failed: user=${userId}, media=${mediaItemId}: ${errorMessage(error)}`,
      );
    }
  }
}
