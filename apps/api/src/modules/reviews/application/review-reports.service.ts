import { Injectable, Inject, HttpStatus } from '@nestjs/common';

import { ErrorCode } from '../../../common/enums/error-code.enum';
import { AppException } from '../../../common/exceptions/app.exception';
import { NotFoundException } from '../../../common/exceptions/not-found.exception';
import {
  REVIEW_LIMITS,
  type ReportReason,
  type ReportStatus,
} from '../domain/constants/review.constants';
import type { ReviewReport, ReviewReportWithReview } from '../domain/entities/review-report.entity';
import {
  REVIEW_REPORT_REPOSITORY,
  type IReviewReportRepository,
} from '../domain/repositories/review-report.repository.interface';
import {
  REVIEW_REPOSITORY,
  type IReviewRepository,
} from '../domain/repositories/review.repository.interface';

interface CreateReportInput {
  userId: string;
  reviewId: string;
  reason: ReportReason;
  details?: string;
}

interface ResolveReportInput {
  reportId: string;
  moderatorId: string;
  status: Exclude<ReportStatus, 'pending'>;
  moderatorNotes?: string;
  hideReview?: boolean;
}

interface ListReportsParams {
  status?: ReportStatus;
  limit?: number;
  offset?: number;
}

@Injectable()
export class ReviewReportsService {
  constructor(
    @Inject(REVIEW_REPORT_REPOSITORY)
    private readonly reportRepo: IReviewReportRepository,
    @Inject(REVIEW_REPOSITORY)
    private readonly reviewRepo: IReviewRepository,
  ) {}

  /**
   * Create a report for a review.
   */
  async create(input: CreateReportInput): Promise<ReviewReport> {
    const { userId, reviewId, reason, details } = input;

    // Check review exists
    const review = await this.reviewRepo.findById(reviewId);
    if (!review || review.isDeleted) {
      throw new NotFoundException(ErrorCode.REVIEW_NOT_FOUND, 'Review not found', { reviewId });
    }

    // Cannot report own review
    if (review.userId === userId) {
      throw new AppException(ErrorCode.FORBIDDEN, 'Cannot report own review', HttpStatus.FORBIDDEN);
    }

    // Check if already reported
    const alreadyReported = await this.reportRepo.existsByUserAndReview(userId, reviewId);
    if (alreadyReported) {
      throw new AppException(
        ErrorCode.REPORT_ALREADY_EXISTS,
        'Already reported this review',
        HttpStatus.CONFLICT,
      );
    }

    // Rate limit check
    const todayCount = await this.reportRepo.countUserReportsToday(userId);
    if (todayCount >= REVIEW_LIMITS.RATE_LIMIT_REPORTS_PER_DAY) {
      throw new AppException(
        ErrorCode.RATE_LIMITED,
        'Daily report limit reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Trim details
    const trimmedDetails = details?.trim() || undefined;

    return this.reportRepo.create({
      reviewId,
      reporterId: userId,
      reason,
      details: trimmedDetails,
    });
  }

  /**
   * List reports for moderation queue.
   */
  async listForModeration(params: ListReportsParams): Promise<{
    data: ReviewReportWithReview[];
    total: number;
  }> {
    const [data, total] = await Promise.all([
      this.reportRepo.findForModeration(params),
      this.reportRepo.countByStatus(params.status),
    ]);

    return { data, total };
  }

  /**
   * Resolve a report (admin action).
   */
  async resolve(input: ResolveReportInput): Promise<void> {
    const { reportId, moderatorId, status, moderatorNotes, hideReview } = input;

    // Check report exists
    const report = await this.reportRepo.findById(reportId);
    if (!report) {
      throw new NotFoundException(ErrorCode.RESOURCE_NOT_FOUND, 'Report not found', { reportId });
    }

    // Already resolved
    if (report.status !== 'pending') {
      throw new AppException(
        ErrorCode.REPORT_ALREADY_RESOLVED,
        'Report already resolved',
        HttpStatus.CONFLICT,
      );
    }

    // Update report status
    await this.reportRepo.updateStatus({
      reportId,
      status,
      moderatorId,
      moderatorNotes,
    });

    // If actioned and hideReview, soft delete the review
    if (status === 'actioned' && hideReview) {
      await this.reviewRepo.softDelete(report.reviewId);
    }
  }
}
