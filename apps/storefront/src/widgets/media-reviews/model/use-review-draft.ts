'use client';

import { useState } from 'react';
import type { Review, ReviewDraft } from '@/shared/api';

export interface DraftGaps {
  isRatingMissing: boolean;
  isTextMissing: boolean;
}

export interface ReviewDraftState {
  content: string;
  rating: number | null;
  hasSpoiler: boolean;
  hasContentChanges: boolean;
  gaps: DraftGaps;
  setContent: (content: string) => void;
  setRating: (rating: number) => void;
  setHasSpoiler: (hasSpoiler: boolean) => void;
  resetContent: () => void;
  toDraft: () => ReviewDraft | null;
}

export function useReviewDraft(editing: Review | null, ownRating: number | null): ReviewDraftState {
  const initialContent = editing?.content ?? '';
  const initialSpoiler = editing?.hasSpoiler ?? false;
  const [content, setContent] = useState(initialContent);
  const [pickedRating, setRating] = useState<number | null>(null);
  const [hasSpoiler, setHasSpoiler] = useState(initialSpoiler);
  const rating = pickedRating ?? editing?.rating ?? ownRating;
  const text = content.trim();
  const gaps: DraftGaps = { isRatingMissing: rating === null, isTextMissing: text === '' };

  return {
    content,
    rating,
    hasSpoiler,
    hasContentChanges: text !== initialContent.trim() || hasSpoiler !== initialSpoiler,
    gaps,
    setContent,
    setRating,
    setHasSpoiler,
    resetContent: () => {
      setContent(initialContent);
      setHasSpoiler(initialSpoiler);
    },
    toDraft: () =>
      rating === null || gaps.isTextMissing ? null : { content: text, rating, hasSpoiler },
  };
}
