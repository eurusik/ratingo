import type { ReportStatus } from '../constants/review.constants';
import type {
  ReviewReport,
  ReviewReportWithReview,
  CreateReportInput,
} from '../entities/review-report.entity';

export const REVIEW_REPORT_REPOSITORY = Symbol('REVIEW_REPORT_REPOSITORY');

/**
 * Repository interface for review reports.
 */
export interface IReviewReportRepository {
  /**
   * Find a report by ID.
   */
  findById(id: string): Promise<ReviewReport | null>;

  /**
   * Check if user already reported this review.
   */
  existsByUserAndReview(userId: string, reviewId: string): Promise<boolean>;

  /**
   * Create a new report.
   */
  create(input: CreateReportInput): Promise<ReviewReport>;

  /**
   * List reports for moderation queue.
   * Ordered by createdAt ascending (oldest first).
   */
  findForModeration(params: {
    status?: ReportStatus;
    limit?: number;
    offset?: number;
  }): Promise<ReviewReportWithReview[]>;

  /**
   * Count reports by status.
   */
  countByStatus(status?: ReportStatus): Promise<number>;

  /**
   * Update report status (for moderation).
   */
  updateStatus(params: {
    reportId: string;
    status: ReportStatus;
    moderatorId: string;
    moderatorNotes?: string;
  }): Promise<void>;

  /**
   * Count reports from a user today.
   */
  countUserReportsToday(userId: string): Promise<number>;
}
