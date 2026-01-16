/**
 * React Query hooks for admin reports moderation.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import {
  adminReportsApi,
  type ListReportsParams,
  type ResolveReportParams,
  type AdminReportListResponseDto,
} from '../api/admin-reports.client';

// Query keys
export const adminReportsKeys = {
  all: ['admin-reports'] as const,
  list: (params?: ListReportsParams) => [...adminReportsKeys.all, 'list', params] as const,
};

/**
 * Fetch reports for moderation queue.
 */
export function useAdminReports(params: ListReportsParams = {}) {
  return useQuery({
    queryKey: adminReportsKeys.list(params),
    queryFn: () => adminReportsApi.listReports(params),
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Resolve a report.
 */
export function useResolveReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: ResolveReportParams) => adminReportsApi.resolveReport(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminReportsKeys.all });
    },
  });
}

/**
 * Force delete a review (admin).
 */
export function useForceDeleteReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reviewId: string) => adminReportsApi.forceDeleteReview(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminReportsKeys.all });
    },
  });
}
