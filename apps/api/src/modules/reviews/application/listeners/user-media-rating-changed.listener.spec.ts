import { UserMediaRatingChangedEvent } from '../../../user-media/domain/events/user-media-rating-changed.event';

import { UserMediaRatingChangedListener } from './user-media-rating-changed.listener';

describe('UserMediaRatingChangedListener', () => {
  const reviewsService = {
    syncRatingToReview: jest.fn().mockResolvedValue(undefined),
  };

  let listener: UserMediaRatingChangedListener;

  beforeEach(() => {
    jest.clearAllMocks();
    listener = new UserMediaRatingChangedListener(reviewsService as any);
  });

  it('should sync rating to review when event is received', async () => {
    const event = new UserMediaRatingChangedEvent('u1', 'm1', 85);

    await listener.handleRatingChanged(event);

    expect(reviewsService.syncRatingToReview).toHaveBeenCalledWith('u1', 'm1', 85);
  });

  it('should not throw when sync fails', async () => {
    reviewsService.syncRatingToReview.mockRejectedValue(new Error('DB error'));
    const event = new UserMediaRatingChangedEvent('u1', 'm1', 85);

    await expect(listener.handleRatingChanged(event)).resolves.not.toThrow();
  });

  it('should handle rating 0 (falsy edge case)', async () => {
    const event = new UserMediaRatingChangedEvent('u1', 'm1', 0);

    await listener.handleRatingChanged(event);

    expect(reviewsService.syncRatingToReview).toHaveBeenCalledWith('u1', 'm1', 0);
  });
});
