/**
 * Admin Reports API client for review moderation.
 */

import type { components } from '@ratingo/api-contract';

import { apiGet, apiPatch, apiDelete } from './client';

// ============================================================================
// Types from API contract
// ============================================================================

export type ReportWithReviewDto = components['schemas']['ReportWithReviewDto'];
export type AdminReportListResponseDto = components['schemas']['AdminReportListResponseDto'];
export type ReportStatus = 'pending' | 'reviewed' | 'dismissed' | 'actioned';

export interface ListReportsParams {
  status?: ReportStatus;
  limit?: number;
  offset?: number;
}

export interface ResolveReportParams {
  reportId: string;
  status: Exclude<ReportStatus, 'pending'>;
  moderatorNotes?: string;
  hideReview?: boolean;
}

// ============================================================================
// API Client
// ============================================================================

export const adminReportsApi = {
  /**
   * List reports for moderation queue.
   */
  async listReports(params: ListReportsParams = {}): Promise<AdminReportListResponseDto> {
    return apiGet<AdminReportListResponseDto>('admin/reviews/reports', {
      searchParams: params as Record<string, string | number | boolean>,
    });
  },

  /**
   * Resolve a report.
   */
  async resolveReport(params: ResolveReportParams): Promise<{ success: boolean }> {
    const { reportId, ...body } = params;
    return apiPatch<{ success: boolean }>(`admin/reviews/reports/${reportId}`, body);
  },

  /**
   * Force delete a review.
   */
  async forceDeleteReview(reviewId: string): Promise<{ success: boolean }> {
    return apiDelete<{ success: boolean }>(`admin/reviews/${reviewId}`);
  },
};
