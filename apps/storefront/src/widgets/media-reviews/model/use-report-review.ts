'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { ErrorCode, getApiErrorCode } from '@ratingo/web-core/api';
import { reviewsApi, type ReportReason } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { reportedReviews } from './review-visibility';

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

type ReportOutcome = 'sent' | 'already';

async function sendReport({ reviewId, reason, details }: Report): Promise<ReportOutcome> {
  try {
    await reviewsApi.report(reviewId, reason, details);
    return 'sent';
  } catch (error) {
    if ((await getApiErrorCode(error)) === ErrorCode.REPORT_ALREADY_EXISTS) return 'already';
    console.error('Reporting a review failed', { reviewId, error });
    throw error;
  }
}

export function useReportReview(onReported: () => void) {
  const { dict } = useTranslation();

  return useMutation({
    mutationFn: sendReport,
    onSuccess: (outcome, { reviewId }) => {
      reportedReviews.add(reviewId);
      toast.success(outcome === 'sent' ? dict.reviews.report.sent : dict.reviews.report.already);
      onReported();
    },
  });
}
