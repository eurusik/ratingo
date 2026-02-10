import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { UserMediaRatingChangedEvent } from '../../../user-media/domain/events/user-media-rating-changed.event';
import { CommunityRatingService } from '../services/community-rating.service';

/**
 * Listens for user rating changes and triggers community average recalculation.
 *
 * When a user rates (or clears their rating) via presets,
 * UserMediaRatingChangedEvent is emitted. This listener recalculates
 * the community average for the affected media item.
 *
 * Errors are caught and logged to prevent event handler failures
 * from propagating to the caller.
 */
@Injectable()
export class CommunityRatingChangedListener {
  private readonly logger = new Logger(CommunityRatingChangedListener.name);

  constructor(private readonly communityRatingService: CommunityRatingService) {}

  @OnEvent(UserMediaRatingChangedEvent.eventName)
  async handleRatingChanged(event: UserMediaRatingChangedEvent): Promise<void> {
    try {
      await this.communityRatingService.recalculateForMediaItem(event.mediaItemId);
    } catch (error) {
      this.logger.warn(
        `Failed to recalculate community rating: media=${event.mediaItemId}`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}
