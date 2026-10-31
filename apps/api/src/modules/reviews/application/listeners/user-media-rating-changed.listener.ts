import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { UserMediaRatingChangedEvent } from '../../../user-media/public';
import { ReviewsService } from '../reviews.service';

/**
 * Syncs standalone rating changes to the reviews aggregate.
 *
 * Listens for UserMediaRatingChangedEvent (emitted when the user
 * rates via presets) and updates the corresponding review rating
 * if one exists. No-op when there is no review or the rating matches.
 */
@Injectable()
export class UserMediaRatingChangedListener {
  private readonly logger = new Logger(UserMediaRatingChangedListener.name);

  constructor(private readonly reviewsService: ReviewsService) {}

  @OnEvent(UserMediaRatingChangedEvent.eventName)
  async handleRatingChanged(event: UserMediaRatingChangedEvent): Promise<void> {
    try {
      await this.reviewsService.syncRatingToReview(event.userId, event.mediaItemId, event.rating);
    } catch (error) {
      this.logger.warn(
        `Failed to sync rating to review: user=${event.userId}, media=${event.mediaItemId}`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}
