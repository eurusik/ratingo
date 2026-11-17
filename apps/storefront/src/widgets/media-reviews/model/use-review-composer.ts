'use client';

import type { Review } from '@/shared/api';
import { useGuardedClose } from '../lib/use-guarded-close';
import { useReviewDraft, type ReviewDraftState } from './use-review-draft';

export function useReviewComposer(
  editing: Review | null,
  ownRating: number | null,
  discard: (draft: ReviewDraftState) => void,
) {
  const draft = useReviewDraft(editing, ownRating);
  const closing = useGuardedClose(draft.hasContentChanges, () => discard(draft));
  return { draft, closing };
}
