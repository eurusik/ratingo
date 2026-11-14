'use client';

import { Button } from '@heroui/react';
import type { Review } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import { reportedReviews } from '../model/hidden-reviews';

export function ReportedReview({ review }: { review: Review }) {
  const { dict } = useTranslation();

  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-surface px-3.5 py-2 text-sm text-muted">
      <span className="min-w-0 flex-1 break-words">
        {interpolate(dict.reviews.card.reported, { name: review.author.username })}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onPress={() => reportedReviews.remove(review.id)}
        className="min-h-tap shrink-0 font-semibold text-accent"
      >
        {dict.reviews.card.show}
      </Button>
    </div>
  );
}
