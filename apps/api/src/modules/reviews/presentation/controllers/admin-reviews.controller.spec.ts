import { Test, TestingModule } from '@nestjs/testing';

import { REPORT_REASON } from '../../domain/constants/review.constants';
import { ReviewReportsService } from '../../application/review-reports.service';
import { ReviewsService } from '../../application/reviews.service';
import { AdminReviewsController } from './admin-reviews.controller';

describe('AdminReviewsController', () => {
  let controller: AdminReviewsController;
  let reviewsService: jest.Mocked<ReviewsService>;
  let reportsService: jest.Mocked<ReviewReportsService>;

  const mockAdmin = { id: 'admin-id-1' };

  const mockReport = {
    id: 'report-id-1',
    reviewId: 'review-id-1',
    reason: REPORT_REASON.SPAM,
    details: null,
    status: 'pending',
    createdAt: new Date('2024-01-15T12:00:00Z'),
    moderatorId: null,
    moderatorNotes: null,
    resolvedAt: null,
    review: {
      id: 'review-id-1',
      content: 'Spam content',
      hasSpoiler: false,
      isDeleted: false,
      author: { id: 'user-id-1', username: 'spammer' },
    },
    reporter: { id: 'reporter-id-1', username: 'reporter' },
  };

  beforeEach(async () => {
    const mockReviewsService = {
      forceDelete: jest.fn().mockResolvedValue(undefined),
    };

    const mockReportsService = {
      listForModeration: jest.fn().mockResolvedValue({
        data: [mockReport],
        total: 1,
      }),
      resolve: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminReviewsController],
      providers: [
        { provide: ReviewsService, useValue: mockReviewsService },
        { provide: ReviewReportsService, useValue: mockReportsService },
      ],
    }).compile();

    controller = module.get<AdminReviewsController>(AdminReviewsController);
    reviewsService = module.get(ReviewsService);
    reportsService = module.get(ReviewReportsService);
  });

  describe('listReports', () => {
    it('should return paginated reports list', async () => {
      const result = await controller.listReports({});

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.data[0].id).toBe('report-id-1');
      expect(result.data[0].review.author.username).toBe('spammer');
      expect(reportsService.listForModeration).toHaveBeenCalledWith({
        status: undefined,
        limit: 20,
        offset: 0,
      });
    });

    it('should pass query params to service', async () => {
      await controller.listReports({ status: 'pending', limit: 10, offset: 5 });

      expect(reportsService.listForModeration).toHaveBeenCalledWith({
        status: 'pending',
        limit: 10,
        offset: 5,
      });
    });
  });

  describe('resolveReport', () => {
    it('should resolve report and return success', async () => {
      const result = await controller.resolveReport(
        'report-id-1',
        { status: 'reviewed', moderatorNotes: 'Checked' },
        mockAdmin,
      );

      expect(result).toEqual({ success: true });
      expect(reportsService.resolve).toHaveBeenCalledWith({
        reportId: 'report-id-1',
        moderatorId: 'admin-id-1',
        status: 'reviewed',
        moderatorNotes: 'Checked',
        hideReview: undefined,
      });
    });

    it('should pass hideReview option when actioning', async () => {
      await controller.resolveReport(
        'report-id-1',
        { status: 'actioned', hideReview: true },
        mockAdmin,
      );

      expect(reportsService.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'actioned',
          hideReview: true,
        }),
      );
    });
  });

  describe('forceDeleteReview', () => {
    it('should force delete review and return success', async () => {
      const result = await controller.forceDeleteReview('review-id-1');

      expect(result).toEqual({ success: true });
      expect(reviewsService.forceDelete).toHaveBeenCalledWith('review-id-1');
    });
  });
});
