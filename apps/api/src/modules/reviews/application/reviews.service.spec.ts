import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppException } from '../../../common/exceptions/app.exception';
import { NotFoundException } from '../../../common/exceptions/not-found.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { REVIEW_LIMITS, REVIEW_SORT } from '../domain/constants/review.constants';
import { REVIEW_REPOSITORY } from '../domain/repositories/review.repository.interface';

import { ReviewsService } from './reviews.service';

describe('ReviewsService', () => {
  let service: ReviewsService;
  let reviewRepo: any;

  const mockReview = {
    id: 'review-id-1',
    userId: 'user-id-1',
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
  };

  const mockReviewWithAuthor = {
    ...mockReview,
    author: {
      id: 'user-id-1',
      username: 'testuser',
      avatarUrl: 'https://example.com/avatar.jpg',
      showRatings: true,
      isProfilePublic: true,
    },
  };

  beforeEach(async () => {
    reviewRepo = {
      findByMediaItem: jest.fn().mockResolvedValue({
        reviews: [mockReviewWithAuthor],
        total: 1,
      }),
      findById: jest.fn().mockResolvedValue(mockReview),
      findByIdWithAuthor: jest.fn().mockResolvedValue(mockReviewWithAuthor),
      findByUserAndMedia: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(mockReview),
      update: jest.fn().mockResolvedValue(mockReview),
      softDelete: jest.fn().mockResolvedValue(undefined),
      hardDelete: jest.fn().mockResolvedValue(undefined),
      countUserReviewsToday: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ReviewsService, { provide: REVIEW_REPOSITORY, useValue: reviewRepo }],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  describe('listForMedia', () => {
    it('should return reviews with default options', async () => {
      const result = await service.listForMedia({
        mediaItemId: 'media-id-1',
      });

      expect(result.reviews).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(reviewRepo.findByMediaItem).toHaveBeenCalledWith({
        mediaItemId: 'media-id-1',
        sort: REVIEW_SORT.NEWEST,
        limit: 20,
        offset: 0,
        hideSpoilers: undefined,
      });
    });

    it('should respect custom options', async () => {
      await service.listForMedia({
        mediaItemId: 'media-id-1',
        sort: REVIEW_SORT.MOST_LIKED,
        limit: 50,
        offset: 10,
        hideSpoilers: true,
      });

      expect(reviewRepo.findByMediaItem).toHaveBeenCalledWith({
        mediaItemId: 'media-id-1',
        sort: REVIEW_SORT.MOST_LIKED,
        limit: 50,
        offset: 10,
        hideSpoilers: true,
      });
    });

    it('should cap limit at MAX_PAGE_SIZE', async () => {
      await service.listForMedia({
        mediaItemId: 'media-id-1',
        limit: 500,
      });

      expect(reviewRepo.findByMediaItem).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 100,
        }),
      );
    });
  });

  describe('getById', () => {
    it('should return review with author', async () => {
      const result = await service.getById('review-id-1');

      expect(result).toEqual(mockReviewWithAuthor);
      expect(reviewRepo.findByIdWithAuthor).toHaveBeenCalledWith('review-id-1');
    });

    it('should throw NotFoundException when review not found', async () => {
      reviewRepo.findByIdWithAuthor.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a new review', async () => {
      const result = await service.create({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        content: 'Great movie!',
        rating: 85,
        hasSpoiler: false,
      });

      expect(result).toEqual(mockReview);
      expect(reviewRepo.create).toHaveBeenCalledWith({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        content: 'Great movie!',
        rating: 85,
        hasSpoiler: false,
      });
    });

    it('should trim content', async () => {
      await service.create({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        content: '  Great movie!  ',
        rating: 85,
      });

      expect(reviewRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Great movie!',
        }),
      );
    });

    it('should throw CONFLICT when user already has a review', async () => {
      reviewRepo.findByUserAndMedia.mockResolvedValue(mockReview);

      await expect(
        service.create({
          userId: 'user-id-1',
          mediaItemId: 'media-id-1',
          content: 'Another review',
          rating: 90,
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCode.REVIEW_ALREADY_EXISTS,
        }),
      );
    });

    it('should throw RATE_LIMITED when daily limit exceeded', async () => {
      reviewRepo.countUserReviewsToday.mockResolvedValue(REVIEW_LIMITS.RATE_LIMIT_REVIEWS_PER_DAY);

      await expect(
        service.create({
          userId: 'user-id-1',
          mediaItemId: 'new-media',
          content: 'New review',
          rating: 75,
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCode.RATE_LIMITED,
        }),
      );
    });
  });

  describe('update', () => {
    it('should update review when user is author', async () => {
      const result = await service.update('review-id-1', 'user-id-1', {
        content: 'Updated content',
        rating: 90,
      });

      expect(result).toEqual(mockReview);
      expect(reviewRepo.update).toHaveBeenCalledWith('review-id-1', {
        content: 'Updated content',
        rating: 90,
      });
    });

    it('should throw NotFoundException when review not found', async () => {
      reviewRepo.findById.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', 'user-id-1', { content: 'Update' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw FORBIDDEN when user is not author', async () => {
      await expect(
        service.update('review-id-1', 'different-user', { content: 'Update' }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCode.FORBIDDEN,
        }),
      );
    });
  });

  describe('delete', () => {
    it('should soft delete review when user is author', async () => {
      await service.delete('review-id-1', 'user-id-1');

      expect(reviewRepo.softDelete).toHaveBeenCalledWith('review-id-1');
    });

    it('should throw NotFoundException when review not found', async () => {
      reviewRepo.findById.mockResolvedValue(null);

      await expect(service.delete('nonexistent', 'user-id-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw FORBIDDEN when user is not author', async () => {
      await expect(service.delete('review-id-1', 'different-user')).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCode.FORBIDDEN,
        }),
      );
    });
  });

  describe('hardDelete', () => {
    it('should hard delete review (admin)', async () => {
      await service.hardDelete('review-id-1');

      expect(reviewRepo.hardDelete).toHaveBeenCalledWith('review-id-1');
    });

    it('should throw NotFoundException when review not found', async () => {
      reviewRepo.findById.mockResolvedValue(null);

      await expect(service.hardDelete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
