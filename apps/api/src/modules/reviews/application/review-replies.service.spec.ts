import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { AppException } from '../../../common/exceptions/app.exception';
import { NotFoundException } from '../../../common/exceptions/not-found.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { REVIEW_LIMITS } from '../domain/constants/review.constants';
import { REVIEW_REPLY_REPOSITORY } from '../domain/repositories/review-reply.repository.interface';
import { REVIEW_REPOSITORY } from '../domain/repositories/review.repository.interface';

import { ReviewRepliesService } from './review-replies.service';

describe('ReviewRepliesService', () => {
  let service: ReviewRepliesService;
  let replyRepo: any;
  let reviewRepo: any;

  const mockReview = {
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
  };

  const mockReply = {
    id: 'reply-id-1',
    reviewId: 'review-id-1',
    userId: 'user-id-1',
    parentReplyId: null,
    content: 'Nice review!',
    isDeleted: false,
    createdAt: new Date('2024-01-15T11:00:00Z'),
    updatedAt: new Date('2024-01-15T11:00:00Z'),
  };

  const mockReplyWithAuthor = {
    ...mockReply,
    author: {
      id: 'user-id-1',
      username: 'replier',
      avatarUrl: 'https://example.com/avatar.jpg',
      isProfilePublic: true,
    },
  };

  beforeEach(async () => {
    replyRepo = {
      findByReview: jest.fn().mockResolvedValue([mockReplyWithAuthor]),
      findById: jest.fn().mockResolvedValue(mockReply),
      create: jest.fn().mockResolvedValue(mockReply),
      softDelete: jest.fn().mockResolvedValue(undefined),
      countByReview: jest.fn().mockResolvedValue(1),
      getNestingDepth: jest.fn().mockResolvedValue(0),
    };

    reviewRepo = {
      findById: jest.fn().mockResolvedValue(mockReview),
      incrementRepliesCount: jest.fn().mockResolvedValue(undefined),
      decrementRepliesCount: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewRepliesService,
        { provide: REVIEW_REPLY_REPOSITORY, useValue: replyRepo },
        { provide: REVIEW_REPOSITORY, useValue: reviewRepo },
      ],
    }).compile();

    service = module.get<ReviewRepliesService>(ReviewRepliesService);
  });

  describe('listForReview', () => {
    it('should return replies for a review', async () => {
      const result = await service.listForReview('review-id-1');

      expect(result).toEqual([mockReplyWithAuthor]);
      expect(reviewRepo.findById).toHaveBeenCalledWith('review-id-1');
      expect(replyRepo.findByReview).toHaveBeenCalledWith('review-id-1');
    });

    it('should throw NotFoundException when review not found', async () => {
      reviewRepo.findById.mockResolvedValue(null);

      await expect(service.listForReview('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when review is deleted', async () => {
      reviewRepo.findById.mockResolvedValue({ ...mockReview, isDeleted: true });

      await expect(service.listForReview('review-id-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a reply', async () => {
      const result = await service.create({
        userId: 'user-id-1',
        reviewId: 'review-id-1',
        content: 'Nice review!',
      });

      expect(result).toEqual(mockReply);
      expect(replyRepo.create).toHaveBeenCalledWith({
        userId: 'user-id-1',
        reviewId: 'review-id-1',
        parentReplyId: null,
        content: 'Nice review!',
      });
      expect(reviewRepo.incrementRepliesCount).toHaveBeenCalledWith('review-id-1');
    });

    it('should create a nested reply', async () => {
      const parentReply = { ...mockReply, id: 'parent-reply-id' };
      replyRepo.findById.mockResolvedValue(parentReply);
      replyRepo.getNestingDepth.mockResolvedValue(0);

      await service.create({
        userId: 'user-id-1',
        reviewId: 'review-id-1',
        parentReplyId: 'parent-reply-id',
        content: 'Reply to reply!',
      });

      expect(replyRepo.create).toHaveBeenCalledWith({
        userId: 'user-id-1',
        reviewId: 'review-id-1',
        parentReplyId: 'parent-reply-id',
        content: 'Reply to reply!',
      });
    });

    it('should trim content', async () => {
      await service.create({
        userId: 'user-id-1',
        reviewId: 'review-id-1',
        content: '  Nice review!  ',
      });

      expect(replyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ content: 'Nice review!' }),
      );
    });

    it('should throw NotFoundException when review not found', async () => {
      reviewRepo.findById.mockResolvedValue(null);

      await expect(
        service.create({
          userId: 'user-id-1',
          reviewId: 'nonexistent',
          content: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when parent reply not found', async () => {
      replyRepo.findById.mockResolvedValue(null);

      await expect(
        service.create({
          userId: 'user-id-1',
          reviewId: 'review-id-1',
          parentReplyId: 'nonexistent',
          content: 'Test',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw when parent reply belongs to different review', async () => {
      const wrongReply = { ...mockReply, reviewId: 'other-review-id' };
      replyRepo.findById.mockResolvedValue(wrongReply);

      await expect(
        service.create({
          userId: 'user-id-1',
          reviewId: 'review-id-1',
          parentReplyId: 'reply-id-1',
          content: 'Test',
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCode.INVALID_INPUT,
        }),
      );
    });

    it('should throw when max nesting depth exceeded', async () => {
      replyRepo.getNestingDepth.mockResolvedValue(REVIEW_LIMITS.MAX_REPLIES_DEPTH - 1);

      await expect(
        service.create({
          userId: 'user-id-1',
          reviewId: 'review-id-1',
          parentReplyId: 'reply-id-1',
          content: 'Test',
        }),
      ).rejects.toThrow(AppException);
      expect(replyRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete own reply', async () => {
      await service.delete('reply-id-1', 'user-id-1');

      expect(replyRepo.softDelete).toHaveBeenCalledWith('reply-id-1');
      expect(reviewRepo.decrementRepliesCount).toHaveBeenCalledWith('review-id-1');
    });

    it('should throw NotFoundException when reply not found', async () => {
      replyRepo.findById.mockResolvedValue(null);

      await expect(service.delete('nonexistent', 'user-id-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when reply is deleted', async () => {
      replyRepo.findById.mockResolvedValue({ ...mockReply, isDeleted: true });

      await expect(service.delete('reply-id-1', 'user-id-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw FORBIDDEN when deleting other user reply', async () => {
      await expect(service.delete('reply-id-1', 'other-user-id')).rejects.toThrow(AppException);
      expect(replyRepo.softDelete).not.toHaveBeenCalled();
    });
  });
});
