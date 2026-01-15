import { Test, TestingModule } from '@nestjs/testing';

import { VOTE_TYPE } from '../../domain/constants/review.constants';
import { ReviewRepliesService } from '../../application/review-replies.service';
import { ReviewVotesService } from '../../application/review-votes.service';
import { ReviewsService } from '../../application/reviews.service';
import { UserReviewsController } from './user-reviews.controller';

describe('UserReviewsController', () => {
  let controller: UserReviewsController;
  let reviewsService: jest.Mocked<ReviewsService>;
  let votesService: jest.Mocked<ReviewVotesService>;
  let repliesService: jest.Mocked<ReviewRepliesService>;

  const mockUser = { id: 'user-id-1' };

  const mockReview = {
    id: 'review-id-1',
    userId: 'user-id-1',
    mediaItemId: 'media-id-1',
    content: 'Great movie!',
    rating: 85,
    hasSpoiler: false,
    isDeleted: false,
    likesCount: 0,
    dislikesCount: 0,
    repliesCount: 0,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    deletedAt: null,
  };

  const mockVote = {
    id: 'vote-id-1',
    reviewId: 'review-id-1',
    userId: 'user-id-1',
    voteType: VOTE_TYPE.LIKE,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockReviewsService = {
      create: jest.fn().mockResolvedValue(mockReview),
      getUserReviewForMedia: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(mockReview),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const mockVotesService = {
      vote: jest.fn().mockResolvedValue({ action: 'added', newVote: mockVote }),
      unvote: jest.fn().mockResolvedValue({ action: 'removed', newVote: null }),
    };

    const mockRepliesService = {
      create: jest.fn().mockResolvedValue({
        id: 'reply-id-1',
        reviewId: 'review-id-1',
        userId: 'user-id-1',
        parentReplyId: null,
        content: 'Nice review!',
        createdAt: new Date('2024-01-15T11:00:00Z'),
        updatedAt: new Date('2024-01-15T11:00:00Z'),
      }),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserReviewsController],
      providers: [
        { provide: ReviewsService, useValue: mockReviewsService },
        { provide: ReviewVotesService, useValue: mockVotesService },
        { provide: ReviewRepliesService, useValue: mockRepliesService },
      ],
    }).compile();

    controller = module.get<UserReviewsController>(UserReviewsController);
    reviewsService = module.get(ReviewsService);
    votesService = module.get(ReviewVotesService);
    repliesService = module.get(ReviewRepliesService);
  });

  describe('create', () => {
    it('should create review and return mutation response', async () => {
      const result = await controller.create(mockUser, {
        mediaItemId: 'media-id-1',
        content: 'Great movie!',
        rating: 85,
        hasSpoiler: false,
      });

      expect(result).toEqual({
        id: 'review-id-1',
        mediaItemId: 'media-id-1',
        content: 'Great movie!',
        rating: 85,
        hasSpoiler: false,
        createdAt: mockReview.createdAt,
        updatedAt: mockReview.updatedAt,
      });
      expect(reviewsService.create).toHaveBeenCalledWith({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        content: 'Great movie!',
        rating: 85,
        hasSpoiler: false,
      });
    });

    it('should pass hasSpoiler correctly', async () => {
      await controller.create(mockUser, {
        mediaItemId: 'media-id-1',
        content: 'Spoiler alert!',
        rating: 70,
        hasSpoiler: true,
      });

      expect(reviewsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          hasSpoiler: true,
        }),
      );
    });
  });

  describe('getMyReviewForMedia', () => {
    it('should return null when no review exists', async () => {
      reviewsService.getUserReviewForMedia.mockResolvedValue(null);

      const result = await controller.getMyReviewForMedia(mockUser, 'media-id-1');

      expect(result).toBeNull();
      expect(reviewsService.getUserReviewForMedia).toHaveBeenCalledWith('user-id-1', 'media-id-1');
    });

    it('should return mutation response when review exists', async () => {
      reviewsService.getUserReviewForMedia.mockResolvedValue(mockReview);

      const result = await controller.getMyReviewForMedia(mockUser, 'media-id-1');

      expect(result).toEqual({
        id: 'review-id-1',
        mediaItemId: 'media-id-1',
        content: 'Great movie!',
        rating: 85,
        hasSpoiler: false,
        createdAt: mockReview.createdAt,
        updatedAt: mockReview.updatedAt,
      });
    });
  });

  describe('update', () => {
    it('should update review and return mutation response', async () => {
      const updatedReview = { ...mockReview, content: 'Updated content', rating: 90 };
      reviewsService.update.mockResolvedValue(updatedReview);

      const result = await controller.update(mockUser, 'review-id-1', {
        content: 'Updated content',
        rating: 90,
      });

      expect(result.content).toBe('Updated content');
      expect(result.rating).toBe(90);
      expect(reviewsService.update).toHaveBeenCalledWith('review-id-1', 'user-id-1', {
        content: 'Updated content',
        rating: 90,
        hasSpoiler: undefined,
      });
    });

    it('should allow partial updates', async () => {
      await controller.update(mockUser, 'review-id-1', {
        content: 'Only content updated',
      });

      expect(reviewsService.update).toHaveBeenCalledWith('review-id-1', 'user-id-1', {
        content: 'Only content updated',
        rating: undefined,
        hasSpoiler: undefined,
      });
    });
  });

  describe('delete', () => {
    it('should delete review', async () => {
      await controller.delete(mockUser, 'review-id-1');

      expect(reviewsService.delete).toHaveBeenCalledWith('review-id-1', 'user-id-1');
    });
  });

  describe('vote', () => {
    it('should add vote and return result', async () => {
      const result = await controller.vote(mockUser, 'review-id-1', {
        voteType: VOTE_TYPE.LIKE,
      });

      expect(result).toEqual({
        action: 'added',
        currentVote: VOTE_TYPE.LIKE,
      });
      expect(votesService.vote).toHaveBeenCalledWith('user-id-1', 'review-id-1', VOTE_TYPE.LIKE);
    });

    it('should return changed action when vote type changes', async () => {
      votesService.vote.mockResolvedValue({
        action: 'changed',
        newVote: { ...mockVote, voteType: VOTE_TYPE.DISLIKE },
      });

      const result = await controller.vote(mockUser, 'review-id-1', {
        voteType: VOTE_TYPE.DISLIKE,
      });

      expect(result).toEqual({
        action: 'changed',
        currentVote: VOTE_TYPE.DISLIKE,
      });
    });
  });

  describe('unvote', () => {
    it('should remove vote and return result', async () => {
      const result = await controller.unvote(mockUser, 'review-id-1');

      expect(result).toEqual({
        action: 'removed',
        currentVote: null,
      });
      expect(votesService.unvote).toHaveBeenCalledWith('user-id-1', 'review-id-1');
    });
  });
});
