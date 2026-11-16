'use client';

import { useState } from 'react';
import type { Review, ReviewDraft } from '@/shared/api';

export interface ReviewDraftState {
  content: string;
  rating: number | null;
  hasSpoiler: boolean;
  hasTextChanges: boolean;
  isDirty: boolean;
  setContent: (content: string) => void;
  setRating: (rating: number) => void;
  setHasSpoiler: (hasSpoiler: boolean) => void;
  resetText: () => void;
  toDraft: () => ReviewDraft | null;
}

export function useReviewDraft(editing: Review | null, ownRating: number | null): ReviewDraftState {
  const initialContent = editing?.content ?? '';
  const initialSpoiler = editing?.hasSpoiler ?? false;
  const [content, setContent] = useState(initialContent);
  const [pickedRating, setRating] = useState<number | null>(null);
  const [hasSpoiler, setHasSpoiler] = useState(initialSpoiler);
  const initialRating = editing?.rating ?? ownRating;
  const rating = pickedRating ?? initialRating;
  const hasTextChanges = content.trim() !== initialContent.trim() || hasSpoiler !== initialSpoiler;

  return {
    content,
    rating,
    hasSpoiler,
    hasTextChanges,
    isDirty: hasTextChanges || (pickedRating !== null && pickedRating !== initialRating),
    setContent,
    setRating,
    setHasSpoiler,
    resetText: () => {
      setContent(initialContent);
      setHasSpoiler(initialSpoiler);
    },
    toDraft: () => {
      const text = content.trim();
      if (!text || rating === null) return null;
      return { content: text, rating, hasSpoiler };
    },
  };
}
