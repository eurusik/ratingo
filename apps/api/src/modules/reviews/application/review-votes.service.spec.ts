import { Test, TestingModule } from '@nestjs/testing';

import { NotFoundException } from '../../../common/exceptions/not-found.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { VOTE_TYPE } from '../domain/constants/review.constants';
import { REVIEW_REPOSITORY } from '../domain/repositories/review.repository.interface';
import { REVIEW_VOTE_REPOSITORY } from '../domain/repositories/review-vote.repository.interface';

import { ReviewVotesService } from './review-votes.service';

describe('ReviewVotesService', () => {
  let service: ReviewVotesService;
  let voteRepo: any;
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
    repliesCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockVote = {
    id: 'vote-id-1',
    reviewId: 'review-id-1',
    userId: 'voter-id',
    voteType: VOTE_TYPE.LIKE,
    createdAt: new Date(),
  };

  beforeEach(async () => {
    voteRepo = {
      findByUserAndReview: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(mockVote),
      remove: jest.fn().mockResolvedValue(true),
      countByReview: jest.fn().mockResolvedValue({ likes: 10, dislikes: 2 }),
      findUserVotesForReviews: jest.fn().mockResolvedValue(new Map()),
    };

    reviewRepo = {
      findById: jest.fn().mockResolvedValue(mockReview),
      updateVoteCounts: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewVotesService,
        { provide: REVIEW_VOTE_REPOSITORY, useValue: voteRepo },
        { provide: REVIEW_REPOSITORY, useValue: reviewRepo },
      ],
    }).compile();

    service = module.get<ReviewVotesService>(ReviewVotesService);
  });

  describe('vote', () => {
    it('should add a new vote', async () => {
      const result = await service.vote('voter-id', 'review-id-1', VOTE_TYPE.LIKE);

      expect(result.action).toBe('added');
      expect(result.newVote).toEqual(mockVote);
      expect(voteRepo.upsert).toHaveBeenCalledWith({
        userId: 'voter-id',
        reviewId: 'review-id-1',
        voteType: VOTE_TYPE.LIKE,
      });
      expect(reviewRepo.updateVoteCounts).toHaveBeenCalledWith('review-id-1', {
        likesCount: 10,
        dislikesCount: 2,
      });
    });

    it('should change vote type when user changes their vote', async () => {
      voteRepo.findByUserAndReview.mockResolvedValue({
        ...mockVote,
        voteType: VOTE_TYPE.LIKE,
      });
      const newVote = { ...mockVote, voteType: VOTE_TYPE.DISLIKE };
      voteRepo.upsert.mockResolvedValue(newVote);

      const result = await service.vote('voter-id', 'review-id-1', VOTE_TYPE.DISLIKE);

      expect(result.action).toBe('changed');
      expect(result.newVote?.voteType).toBe(VOTE_TYPE.DISLIKE);
    });

    it('should return existing vote without changes if same vote type', async () => {
      voteRepo.findByUserAndReview.mockResolvedValue(mockVote);

      const result = await service.vote('voter-id', 'review-id-1', VOTE_TYPE.LIKE);

      expect(result.action).toBe('added');
      expect(result.newVote).toEqual(mockVote);
      expect(voteRepo.upsert).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when review not found', async () => {
      reviewRepo.findById.mockResolvedValue(null);

      await expect(service.vote('voter-id', 'nonexistent', VOTE_TYPE.LIKE)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw FORBIDDEN when voting on own review', async () => {
      await expect(service.vote('author-id', 'review-id-1', VOTE_TYPE.LIKE)).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCode.FORBIDDEN,
        }),
      );
    });
  });

  describe('unvote', () => {
    it('should remove vote and update counts', async () => {
      const result = await service.unvote('voter-id', 'review-id-1');

      expect(result.action).toBe('removed');
      expect(result.newVote).toBeNull();
      expect(voteRepo.remove).toHaveBeenCalledWith('voter-id', 'review-id-1');
      expect(reviewRepo.updateVoteCounts).toHaveBeenCalled();
    });

    it('should still return removed action when vote did not exist', async () => {
      voteRepo.remove.mockResolvedValue(false);

      const result = await service.unvote('voter-id', 'review-id-1');

      expect(result.action).toBe('removed');
      expect(result.newVote).toBeNull();
    });

    it('should throw NotFoundException when review not found', async () => {
      reviewRepo.findById.mockResolvedValue(null);

      await expect(service.unvote('voter-id', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUserVote', () => {
    it('should return user vote when exists', async () => {
      voteRepo.findByUserAndReview.mockResolvedValue(mockVote);

      const result = await service.getUserVote('voter-id', 'review-id-1');

      expect(result).toEqual(mockVote);
    });

    it('should return null when vote not found', async () => {
      voteRepo.findByUserAndReview.mockResolvedValue(null);

      const result = await service.getUserVote('voter-id', 'review-id-1');

      expect(result).toBeNull();
    });
  });

  describe('getUserVotesForReviews', () => {
    it('should return map of user votes for multiple reviews', async () => {
      const votesMap = new Map([
        ['review-id-1', mockVote],
        ['review-id-2', { ...mockVote, id: 'vote-id-2', reviewId: 'review-id-2' }],
      ]);
      voteRepo.findUserVotesForReviews.mockResolvedValue(votesMap);

      const result = await service.getUserVotesForReviews('voter-id', [
        'review-id-1',
        'review-id-2',
        'review-id-3',
      ]);

      expect(result.size).toBe(2);
      expect(result.get('review-id-1')).toEqual(mockVote);
    });
  });

  describe('vote toggle behavior', () => {
    it('should toggle from like to dislike', async () => {
      // Initially liked
      voteRepo.findByUserAndReview.mockResolvedValue({
        ...mockVote,
        voteType: VOTE_TYPE.LIKE,
      });
      const dislikeVote = { ...mockVote, voteType: VOTE_TYPE.DISLIKE };
      voteRepo.upsert.mockResolvedValue(dislikeVote);

      const result = await service.vote('voter-id', 'review-id-1', VOTE_TYPE.DISLIKE);

      expect(result.action).toBe('changed');
      expect(result.newVote?.voteType).toBe(VOTE_TYPE.DISLIKE);
    });

    it('should toggle from dislike to like', async () => {
      // Initially disliked
      voteRepo.findByUserAndReview.mockResolvedValue({
        ...mockVote,
        voteType: VOTE_TYPE.DISLIKE,
      });
      const likeVote = { ...mockVote, voteType: VOTE_TYPE.LIKE };
      voteRepo.upsert.mockResolvedValue(likeVote);

      const result = await service.vote('voter-id', 'review-id-1', VOTE_TYPE.LIKE);

      expect(result.action).toBe('changed');
      expect(result.newVote?.voteType).toBe(VOTE_TYPE.LIKE);
    });

    it('should update denormalized counts after vote change', async () => {
      voteRepo.findByUserAndReview.mockResolvedValue({
        ...mockVote,
        voteType: VOTE_TYPE.LIKE,
      });
      voteRepo.countByReview.mockResolvedValue({ likes: 9, dislikes: 3 });
      voteRepo.upsert.mockResolvedValue({ ...mockVote, voteType: VOTE_TYPE.DISLIKE });

      await service.vote('voter-id', 'review-id-1', VOTE_TYPE.DISLIKE);

      expect(reviewRepo.updateVoteCounts).toHaveBeenCalledWith('review-id-1', {
        likesCount: 9,
        dislikesCount: 3,
      });
    });
  });
});
