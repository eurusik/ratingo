'use client';

import { useLayoutEffect, useState, type FormEvent, type RefObject } from 'react';
import type { Review } from '@/shared/api';
import type { DraftGaps, ReviewDraftState } from '../model/use-review-draft';
import { usePublishReview } from '../model/use-publish-review';
import { useReviewsActions } from './reviews-context';

const NO_GAPS: DraftGaps = { isRatingMissing: false, isTextMissing: false };

function useCaretAtEndOnOpen(textRef: RefObject<HTMLTextAreaElement | null>, isEnabled: boolean) {
  useLayoutEffect(() => {
    const text = textRef.current;
    if (!isEnabled || !text) return;
    text.setSelectionRange(text.value.length, text.value.length);
  }, [textRef, isEnabled]);
}

interface ReviewFormOptions {
  firstPresetRef: RefObject<HTMLButtonElement | null>;
  textRef: RefObject<HTMLTextAreaElement | null>;
  draft: ReviewDraftState;
  editing: Review | null;
  focusesTextOnOpen: boolean;
  onPublished: () => void;
}

export function useReviewForm({
  firstPresetRef,
  textRef,
  draft,
  editing,
  focusesTextOnOpen,
  onPublished,
}: ReviewFormOptions) {
  const { media } = useReviewsActions();
  const publish = usePublishReview(media);
  const [shownGaps, setShownGaps] = useState<DraftGaps>(NO_GAPS);
  useCaretAtEndOnOpen(textRef, focusesTextOnOpen);

  const resumeEditing = (filled: Partial<DraftGaps>) => {
    publish.reset();
    setShownGaps((current) => ({ ...current, ...filled }));
  };

  const focusFirstGap = (gaps: DraftGaps) => {
    if (gaps.isRatingMissing) firstPresetRef.current?.focus();
    else if (gaps.isTextMissing) textRef.current?.focus();
  };

  return {
    shownGaps,
    isPublishing: publish.isPending,
    publishFailure: publish.error?.failure ?? null,
    changeRating: (rating: number) => {
      resumeEditing({ isRatingMissing: false });
      draft.setRating(rating);
    },
    changeContent: (content: string) => {
      resumeEditing({ isTextMissing: false });
      draft.setContent(content);
    },
    changeSpoiler: (hasSpoiler: boolean) => {
      resumeEditing({});
      draft.setHasSpoiler(hasSpoiler);
    },
    submit: (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (publish.isPending) return;
      setShownGaps(draft.gaps);
      focusFirstGap(draft.gaps);
      const ready = draft.toDraft();
      if (ready) publish.mutate({ draft: ready, editing }, { onSuccess: onPublished });
    },
  };
}

export type ReviewFormState = ReturnType<typeof useReviewForm>;
