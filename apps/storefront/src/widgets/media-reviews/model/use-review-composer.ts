'use client';

import type { Review } from '@/shared/api';
import { useGuardedClose } from '../lib/use-guarded-close';
import { useReviewDraft } from './use-review-draft';

export function useReviewComposer(
  editing: Review | null,
  ownRating: number | null,
  close: () => void,
) {
  const draft = useReviewDraft(editing, ownRating);
  const closing = useGuardedClose(draft.isDirty, close);
  return { draft, closing };
}
