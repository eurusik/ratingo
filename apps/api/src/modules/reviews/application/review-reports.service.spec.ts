import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ErrorCode } from '../../../common/enums/error-code.enum';
import { AppException } from '../../../common/exceptions/app.exception';
import { NotFoundException } from '../../../common/exceptions/not-found.exception';
import { REVIEW_LIMITS, REPORT_REASON, REPORT_STATUS } from '../domain/constants/review.constants';
import type { IReviewReportRepository } from '../domain/repositories/review-report.repository.interface';
import { REVIEW_REPORT_REPOSITORY } from '../domain/repositories/review-report.repository.interface';
import type { IReviewRepository } from '../domain/repositories/review.repository.interface';
import { REVIEW_REPOSITORY } from '../domain/repositories/review.repository.interface';
import { ReviewReportsService } from './review-reports.service';

describe('ReviewReportsService', () => {
  let service: ReviewReportsService;
  let reportRepo: jest.Mocked<IReviewReportRepository>;
  let reviewRepo: jest.Mocked<IReviewRepository>;

  const mockReview = {
    id: 'review-id-1',
    userId: 'author-id-1',
    mediaItemId: 'media-id-1',
    content: 'Great movie!',
    rating: 80,
    hasSpoiler: false,
    isDeleted: false,
    likesCount: 5,
    dislikesCount: 1,
    repliesCount: 0,
    createdAt: new Date('2024-01-15T12:00:00Z'),
    updatedAt: new Date('2024-01-15T12:00:00Z'),
    deletedAt: null,
  };

  const mockReport = {
    id: 'report-id-1',
    reviewId: 'review-id-1',
    reporterId: 'reporter-id-1',
    reason: REPORT_REASON.SPAM,
    details: 'This is spam',
    status: REPORT_STATUS.PENDING,
    moderatorId: null,
    moderatorNotes: null,
    resolvedAt: null,
    createdAt: new Date('2024-01-15T12:00:00Z'),
  };

  beforeEach(async () => {
    const mockReportRepo: Partial<jest.Mocked<IReviewReportRepository>> = {
      findById: jest.fn(),
      existsByUserAndReview: jest.fn(),
      create: jest.fn(),
      findForModeration: jest.fn(),
      countByStatus: jest.fn(),
      updateStatus: jest.fn(),
      countUserReportsToday: jest.fn(),
    };

    const mockReviewRepo: Partial<jest.Mocked<IReviewRepository>> = {
      findById: jest.fn(),
      softDelete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewReportsService,
        { provide: REVIEW_REPORT_REPOSITORY, useValue: mockReportRepo },
        { provide: REVIEW_REPOSITORY, useValue: mockReviewRepo },
      ],
    }).compile();

    service = module.get<ReviewReportsService>(ReviewReportsService);
    reportRepo = module.get(REVIEW_REPORT_REPOSITORY);
    reviewRepo = module.get(REVIEW_REPOSITORY);
  });

  describe('create', () => {
    it('should create a report successfully', async () => {
      reviewRepo.findById.mockResolvedValue(mockReview);
      reportRepo.existsByUserAndReview.mockResolvedValue(false);
      reportRepo.countUserReportsToday.mockResolvedValue(0);
      reportRepo.create.mockResolvedValue(mockReport);

      const result = await service.create({
        userId: 'reporter-id-1',
        reviewId: 'review-id-1',
        reason: REPORT_REASON.SPAM,
        details: 'This is spam',
      });

      expect(result).toEqual(mockReport);
      expect(reportRepo.create).toHaveBeenCalledWith({
        reviewId: 'review-id-1',
        reporterId: 'reporter-id-1',
        reason: REPORT_REASON.SPAM,
        details: 'This is spam',
      });
    });

    it('should throw NotFoundException when review does not exist', async () => {
      reviewRepo.findById.mockResolvedValue(null);

      await expect(
        service.create({
          userId: 'reporter-id-1',
          reviewId: 'nonexistent-review',
          reason: REPORT_REASON.SPAM,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when review is deleted', async () => {
      reviewRepo.findById.mockResolvedValue({ ...mockReview, isDeleted: true });

      await expect(
        service.create({
          userId: 'reporter-id-1',
          reviewId: 'review-id-1',
          reason: REPORT_REASON.SPAM,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw FORBIDDEN when reporting own review', async () => {
      reviewRepo.findById.mockResolvedValue(mockReview);

      await expect(
        service.create({
          userId: 'author-id-1', // Same as review author
          reviewId: 'review-id-1',
          reason: REPORT_REASON.SPAM,
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCode.FORBIDDEN,
        }),
      );
    });

    it('should throw REPORT_ALREADY_EXISTS when already reported', async () => {
      reviewRepo.findById.mockResolvedValue(mockReview);
      reportRepo.existsByUserAndReview.mockResolvedValue(true);

      await expect(
        service.create({
          userId: 'reporter-id-1',
          reviewId: 'review-id-1',
          reason: REPORT_REASON.SPAM,
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCode.REPORT_ALREADY_EXISTS,
        }),
      );
    });

    it('should throw RATE_LIMITED when daily limit exceeded', async () => {
      reviewRepo.findById.mockResolvedValue(mockReview);
      reportRepo.existsByUserAndReview.mockResolvedValue(false);
      reportRepo.countUserReportsToday.mockResolvedValue(REVIEW_LIMITS.RATE_LIMIT_REPORTS_PER_DAY);

      await expect(
        service.create({
          userId: 'reporter-id-1',
          reviewId: 'review-id-1',
          reason: REPORT_REASON.SPAM,
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCode.RATE_LIMITED,
        }),
      );
    });

    it('should trim whitespace from details', async () => {
      reviewRepo.findById.mockResolvedValue(mockReview);
      reportRepo.existsByUserAndReview.mockResolvedValue(false);
      reportRepo.countUserReportsToday.mockResolvedValue(0);
      reportRepo.create.mockResolvedValue(mockReport);

      await service.create({
        userId: 'reporter-id-1',
        reviewId: 'review-id-1',
        reason: REPORT_REASON.SPAM,
        details: '  whitespace around  ',
      });

      expect(reportRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          details: 'whitespace around',
        }),
      );
    });

    it('should handle empty details as undefined', async () => {
      reviewRepo.findById.mockResolvedValue(mockReview);
      reportRepo.existsByUserAndReview.mockResolvedValue(false);
      reportRepo.countUserReportsToday.mockResolvedValue(0);
      reportRepo.create.mockResolvedValue(mockReport);

      await service.create({
        userId: 'reporter-id-1',
        reviewId: 'review-id-1',
        reason: REPORT_REASON.SPAM,
        details: '   ',
      });

      expect(reportRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          details: undefined,
        }),
      );
    });
  });

  describe('listForModeration', () => {
    const mockReportWithReview = {
      ...mockReport,
      review: {
        id: 'review-id-1',
        content: 'Great movie!',
        hasSpoiler: false,
        isDeleted: false,
        author: { id: 'author-id-1', username: 'author' },
      },
      reporter: { id: 'reporter-id-1', username: 'reporter' },
    };

    it('should return paginated reports list', async () => {
      reportRepo.findForModeration.mockResolvedValue([mockReportWithReview]);
      reportRepo.countByStatus.mockResolvedValue(1);

      const result = await service.listForModeration({});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should pass params to repository', async () => {
      reportRepo.findForModeration.mockResolvedValue([]);
      reportRepo.countByStatus.mockResolvedValue(0);

      await service.listForModeration({
        status: REPORT_STATUS.PENDING,
        limit: 10,
        offset: 5,
      });

      expect(reportRepo.findForModeration).toHaveBeenCalledWith({
        status: REPORT_STATUS.PENDING,
        limit: 10,
        offset: 5,
      });
      expect(reportRepo.countByStatus).toHaveBeenCalledWith(REPORT_STATUS.PENDING);
    });
  });

  describe('resolve', () => {
    it('should resolve report successfully', async () => {
      reportRepo.findById.mockResolvedValue(mockReport);
      reportRepo.updateStatus.mockResolvedValue(undefined);

      await service.resolve({
        reportId: 'report-id-1',
        moderatorId: 'admin-id-1',
        status: REPORT_STATUS.REVIEWED,
        moderatorNotes: 'Checked, no action needed',
      });

      expect(reportRepo.updateStatus).toHaveBeenCalledWith({
        reportId: 'report-id-1',
        status: REPORT_STATUS.REVIEWED,
        moderatorId: 'admin-id-1',
        moderatorNotes: 'Checked, no action needed',
      });
    });

    it('should throw NotFoundException when report does not exist', async () => {
      reportRepo.findById.mockResolvedValue(null);

      await expect(
        service.resolve({
          reportId: 'nonexistent-report',
          moderatorId: 'admin-id-1',
          status: REPORT_STATUS.REVIEWED,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw REPORT_ALREADY_RESOLVED when not pending', async () => {
      reportRepo.findById.mockResolvedValue({
        ...mockReport,
        status: REPORT_STATUS.REVIEWED,
      });

      await expect(
        service.resolve({
          reportId: 'report-id-1',
          moderatorId: 'admin-id-1',
          status: REPORT_STATUS.DISMISSED,
        }),
      ).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCode.REPORT_ALREADY_RESOLVED,
        }),
      );
    });

    it('should soft delete review when actioned with hideReview', async () => {
      reportRepo.findById.mockResolvedValue(mockReport);
      reportRepo.updateStatus.mockResolvedValue(undefined);
      reviewRepo.softDelete.mockResolvedValue(undefined);

      await service.resolve({
        reportId: 'report-id-1',
        moderatorId: 'admin-id-1',
        status: REPORT_STATUS.ACTIONED,
        hideReview: true,
      });

      expect(reviewRepo.softDelete).toHaveBeenCalledWith('review-id-1');
    });

    it('should not delete review when actioned without hideReview', async () => {
      reportRepo.findById.mockResolvedValue(mockReport);
      reportRepo.updateStatus.mockResolvedValue(undefined);

      await service.resolve({
        reportId: 'report-id-1',
        moderatorId: 'admin-id-1',
        status: REPORT_STATUS.ACTIONED,
        hideReview: false,
      });

      expect(reviewRepo.softDelete).not.toHaveBeenCalled();
    });

    it('should not delete review for non-actioned status', async () => {
      reportRepo.findById.mockResolvedValue(mockReport);
      reportRepo.updateStatus.mockResolvedValue(undefined);

      await service.resolve({
        reportId: 'report-id-1',
        moderatorId: 'admin-id-1',
        status: REPORT_STATUS.DISMISSED,
        hideReview: true, // Should be ignored
      });

      expect(reviewRepo.softDelete).not.toHaveBeenCalled();
    });
  });
});
