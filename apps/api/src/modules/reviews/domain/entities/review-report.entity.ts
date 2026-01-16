import type { ReportReason, ReportStatus } from '../constants/review.constants';

/**
 * Review report entity.
 */
export interface ReviewReport {
  id: string;
  reviewId: string;
  reporterId: string;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  moderatorId: string | null;
  moderatorNotes: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

/**
 * Input for creating a report.
 */
export interface CreateReportInput {
  reviewId: string;
  reporterId: string;
  reason: ReportReason;
  details?: string;
}

/**
 * Input for resolving a report (admin).
 */
export interface ResolveReportInput {
  reportId: string;
  moderatorId: string;
  status: Exclude<ReportStatus, 'pending'>;
  moderatorNotes?: string;
}

/**
 * Report with related review info for moderation queue.
 */
export interface ReviewReportWithReview extends ReviewReport {
  review: {
    id: string;
    content: string;
    hasSpoiler: boolean;
    isDeleted: boolean;
    author: {
      id: string;
      username: string;
    };
  };
  reporter: {
    id: string;
    username: string;
  };
}
