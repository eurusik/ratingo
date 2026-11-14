'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { ErrorCode, getApiErrorCode } from '@ratingo/web-core/api';
import { reviewsApi, type ReportReason } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { reportedReviews } from './hidden-reviews';

export const REPORT_REASONS = [
  'spam',
  'harassment',
  'hate_speech',
  'spoiler_unmarked',
  'misinformation',
  'other',
] as const satisfies ReportReason[];

interface Report {
  reviewId: string;
  reason: ReportReason;
  details?: string;
}

export function useReportReview(onReported: () => void) {
  const { dict } = useTranslation();

  const hideReported = (reviewId: string, message: string) => {
    reportedReviews.add(reviewId);
    toast.success(message);
    onReported();
  };

  return useMutation({
    mutationFn: ({ reviewId, reason, details }: Report) =>
      reviewsApi.report(reviewId, reason, details),
    onSuccess: (_report, { reviewId }) => hideReported(reviewId, dict.reviews.report.sent),
    onError: async (error, { reviewId }) => {
      if ((await getApiErrorCode(error)) === ErrorCode.REPORT_ALREADY_EXISTS) {
        hideReported(reviewId, dict.reviews.report.already);
        return;
      }
      console.error('Reporting a review failed', { reviewId, error });
      toast.danger(dict.reviews.report.failed);
    },
  });
}
