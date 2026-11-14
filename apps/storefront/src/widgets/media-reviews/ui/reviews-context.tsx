'use client';

import { createContext, useContext } from 'react';
import type { Review, VoteType } from '@/shared/api';
import type { ReviewedMedia } from '../model/reviewed-media';

export interface ReviewsActions {
  media: ReviewedMedia;
  viewerId: string | null;
  ownRating: number | null;
  isDesktop: boolean;
  compose: (editing?: Review) => void;
  report: (review: Review) => void;
  openThread: (review: Review) => void;
  vote: (review: Review, pressed: VoteType) => void;
  remove: (review: Review) => void;
}

const ReviewsContext = createContext<ReviewsActions | null>(null);

export const ReviewsProvider = ReviewsContext.Provider;

export function useReviewsActions(): ReviewsActions {
  const actions = useContext(ReviewsContext);
  if (!actions) throw new Error('useReviewsActions must be used inside ReviewsProvider');
  return actions;
}
