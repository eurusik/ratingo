import { Test, TestingModule } from '@nestjs/testing';

import { DEFAULT_PAGE_SIZE } from '../../../../common/constants';
import { REVIEW_SORT, VOTE_TYPE } from '../../domain/constants/review.constants';
import { ReviewRepliesService } from '../../application/review-replies.service';
import { ReviewVotesService } from '../../application/review-votes.service';
import { ReviewsService } from '../../application/reviews.service';
import { ReviewsController } from './reviews.controller';

describe('ReviewsController', () => {
  let controller: ReviewsController;
  let reviewsService: jest.Mocked<ReviewsService>;
  let votesService: jest.Mocked<ReviewVotesService>;
  let repliesService: jest.Mocked<ReviewRepliesService>;

  const mockUser = { id: 'user-id-1' };

  const mockReviewWithAuthor = {
    id: 'review-id-1',
    userId: 'author-id',
    mediaItemId: 'media-id-1',
    content: 'Great movie!',
    rating: 85,
    hasSpoiler: false,
    isDeleted: false,
    likesCount: 10,
    dislikesCount: 2,
    repliesCount: 3,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    deletedAt: null,
    author: {
      id: 'author-id',
      username: 'testuser',
      avatarUrl: 'https://example.com/avatar.jpg',
      showRatings: true,
      isProfilePublic: true,
    },
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
      listForMedia: jest.fn().mockResolvedValue({
        reviews: [mockReviewWithAuthor],
        total: 1,
      }),
      getById: jest.fn().mockResolvedValue(mockReviewWithAuthor),
    };

    const mockVotesService = {
      getUserVotesForReviews: jest.fn().mockResolvedValue(new Map()),
      getUserVote: jest.fn().mockResolvedValue(null),
    };

    const mockRepliesService = {
      listForReview: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReviewsController],
      providers: [
        { provide: ReviewsService, useValue: mockReviewsService },
        { provide: ReviewVotesService, useValue: mockVotesService },
        { provide: ReviewRepliesService, useValue: mockRepliesService },
      ],
    }).compile();

    controller = module.get<ReviewsController>(ReviewsController);
    reviewsService = module.get(ReviewsService);
    votesService = module.get(ReviewVotesService);
    repliesService = module.get(ReviewRepliesService);
  });

  describe('listForMedia', () => {
    it('should return reviews list with default pagination', async () => {
      const result = await controller.listForMedia('media-id-1', {}, null);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toEqual({
        total: 1,
        limit: DEFAULT_PAGE_SIZE,
        offset: 0,
      });
      expect(reviewsService.listForMedia).toHaveBeenCalledWith({
        mediaItemId: 'media-id-1',
        sort: undefined,
        limit: undefined,
        offset: undefined,
        hideSpoilers: undefined,
      });
    });

    it('should pass query options to service', async () => {
      await controller.listForMedia(
        'media-id-1',
        {
          sort: REVIEW_SORT.MOST_LIKED,
          limit: 50,
          offset: 10,
          hideSpoilers: true,
        },
        null,
      );

      expect(reviewsService.listForMedia).toHaveBeenCalledWith({
        mediaItemId: 'media-id-1',
        sort: REVIEW_SORT.MOST_LIKED,
        limit: 50,
        offset: 10,
        hideSpoilers: true,
      });
    });

    it('should enrich reviews with user votes when authenticated', async () => {
      const votesMap = new Map([[mockReviewWithAuthor.id, mockVote]]);
      votesService.getUserVotesForReviews.mockResolvedValue(votesMap);

      const result = await controller.listForMedia('media-id-1', {}, mockUser);

      expect(votesService.getUserVotesForReviews).toHaveBeenCalledWith('user-id-1', [
        'review-id-1',
      ]);
      expect(result.data[0].currentUserVote).toBe(VOTE_TYPE.LIKE);
    });

    it('should not call votes service when user is null', async () => {
      await controller.listForMedia('media-id-1', {}, null);

      expect(votesService.getUserVotesForReviews).not.toHaveBeenCalled();
    });

    it('should map review to response DTO correctly', async () => {
      const result = await controller.listForMedia('media-id-1', {}, null);
      const reviewDto = result.data[0];

      expect(reviewDto).toEqual({
        id: 'review-id-1',
        mediaItemId: 'media-id-1',
        content: 'Great movie!',
        rating: 85,
        hasSpoiler: false,
        likesCount: 10,
        dislikesCount: 2,
        repliesCount: 3,
        createdAt: mockReviewWithAuthor.createdAt,
        updatedAt: mockReviewWithAuthor.updatedAt,
        author: {
          id: 'author-id',
          username: 'testuser',
          avatarUrl: 'https://example.com/avatar.jpg',
          showRatings: true,
          isProfilePublic: true,
        },
        currentUserVote: null,
      });
    });

    it('should hide rating when author has showRatings=false', async () => {
      reviewsService.listForMedia.mockResolvedValue({
        reviews: [
          {
            ...mockReviewWithAuthor,
            author: { ...mockReviewWithAuthor.author, showRatings: false },
          },
        ],
        total: 1,
      });

      const result = await controller.listForMedia('media-id-1', {}, null);

      expect(result.data[0].rating).toBeNull();
    });

    it('should anonymize author when isProfilePublic=false', async () => {
      reviewsService.listForMedia.mockResolvedValue({
        reviews: [
          {
            ...mockReviewWithAuthor,
            author: { ...mockReviewWithAuthor.author, isProfilePublic: false },
          },
        ],
        total: 1,
      });

      const result = await controller.listForMedia('media-id-1', {}, null);

      expect(result.data[0].author.username).toBe('Анонім');
      expect(result.data[0].author.avatarUrl).toBeNull();
    });
  });

  describe('getById', () => {
    it('should return single review', async () => {
      const result = await controller.getById('review-id-1', null);

      expect(result.id).toBe('review-id-1');
      expect(result.content).toBe('Great movie!');
      expect(reviewsService.getById).toHaveBeenCalledWith('review-id-1');
    });

    it('should enrich with user vote when authenticated', async () => {
      votesService.getUserVote.mockResolvedValue(mockVote);

      const result = await controller.getById('review-id-1', mockUser);

      expect(votesService.getUserVote).toHaveBeenCalledWith('user-id-1', 'review-id-1');
      expect(result.currentUserVote).toBe(VOTE_TYPE.LIKE);
    });

    it('should not call votes service when user is null', async () => {
      await controller.getById('review-id-1', null);

      expect(votesService.getUserVote).not.toHaveBeenCalled();
    });

    it('should return null for currentUserVote when no vote exists', async () => {
      votesService.getUserVote.mockResolvedValue(null);

      const result = await controller.getById('review-id-1', mockUser);

      expect(result.currentUserVote).toBeNull();
    });
  });
});
