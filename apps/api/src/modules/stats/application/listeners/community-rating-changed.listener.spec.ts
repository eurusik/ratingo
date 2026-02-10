import { Test } from '@nestjs/testing';

import { UserMediaRatingChangedEvent } from '../../../user-media/domain/events/user-media-rating-changed.event';
import { CommunityRatingService } from '../services/community-rating.service';

import { CommunityRatingChangedListener } from './community-rating-changed.listener';

describe('CommunityRatingChangedListener', () => {
  let listener: CommunityRatingChangedListener;
  let communityRatingService: jest.Mocked<CommunityRatingService>;

  beforeEach(async () => {
    const mockCommunityRatingService = {
      recalculateForMediaItem: jest.fn(),
      reconcileAll: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        CommunityRatingChangedListener,
        { provide: CommunityRatingService, useValue: mockCommunityRatingService },
      ],
    }).compile();

    listener = module.get(CommunityRatingChangedListener);
    communityRatingService = module.get(CommunityRatingService);
  });

  describe('handleRatingChanged', () => {
    it('should call recalculateForMediaItem with correct mediaItemId', async () => {
      const event = new UserMediaRatingChangedEvent('user-1', 'media-1', 85);
      communityRatingService.recalculateForMediaItem.mockResolvedValue();

      await listener.handleRatingChanged(event);

      expect(communityRatingService.recalculateForMediaItem).toHaveBeenCalledWith('media-1');
    });

    it('should call recalculateForMediaItem when rating is cleared (null)', async () => {
      const event = new UserMediaRatingChangedEvent('user-1', 'media-1', null);
      communityRatingService.recalculateForMediaItem.mockResolvedValue();

      await listener.handleRatingChanged(event);

      expect(communityRatingService.recalculateForMediaItem).toHaveBeenCalledWith('media-1');
    });

    it('should not throw when recalculation fails', async () => {
      const event = new UserMediaRatingChangedEvent('user-1', 'media-1', 75);
      communityRatingService.recalculateForMediaItem.mockRejectedValue(
        new Error('DB connection failed'),
      );

      await expect(listener.handleRatingChanged(event)).resolves.not.toThrow();
    });

    it('should not throw when recalculation fails with non-Error', async () => {
      const event = new UserMediaRatingChangedEvent('user-1', 'media-1', 75);
      communityRatingService.recalculateForMediaItem.mockRejectedValue('string error');

      await expect(listener.handleRatingChanged(event)).resolves.not.toThrow();
    });
  });
});
