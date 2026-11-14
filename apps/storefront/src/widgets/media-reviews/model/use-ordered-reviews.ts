'use client';

import { useMemo } from 'react';
import type { Review } from '@/shared/api';
import { withOwnReviewFirst } from './review-order';

interface OrderedReviewsInput {
  mine: Review | null;
  others: readonly Review[];
  deleting: ReadonlySet<string>;
  editingInline: Review | null;
}

export function useOrderedReviews({ mine, others, deleting, editingInline }: OrderedReviewsInput) {
  const isDeletingMine = mine !== null && deleting.has(mine.id);
  const ownReview = isDeletingMine ? null : mine;
  const ordered = useMemo(() => {
    const hidden = new Set(deleting);
    if (editingInline && ownReview) hidden.add(ownReview.id);
    return withOwnReviewFirst(ownReview, others, hidden);
  }, [deleting, editingInline, ownReview, others]);

  return { ordered, ownReview, isDeletingMine };
}
