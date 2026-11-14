'use client';

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { reviewsApi, type Review, type VoteType } from '@/shared/api';
import { useSignedInAction } from '@/shared/auth';
import { useTranslation } from '@/shared/i18n';
import { refreshMediaReviews, updateReviewEverywhere } from './review-cache';
import { nextVote, withVote } from './review-vote';

interface VoteChange {
  reviewId: string;
  vote: VoteType | null;
}

export function useReviewVote(mediaItemId: string): (review: Review, pressed: VoteType) => void {
  const { dict } = useTranslation();
  const queryClient = useQueryClient();
  const runSignedIn = useSignedInAction();

  const { mutate } = useMutation({
    mutationFn: ({ reviewId, vote }: VoteChange) =>
      vote ? reviewsApi.vote(reviewId, vote) : reviewsApi.unvote(reviewId),
    onMutate: ({ reviewId, vote }) =>
      updateReviewEverywhere(queryClient, mediaItemId, reviewId, (review) =>
        withVote(review, vote),
      ),
    onError: (error, { reviewId }, restore) => {
      console.error('Voting on a review failed', { reviewId, error });
      restore?.();
      toast.danger(dict.reviews.toast.voteFailed);
    },
    onSettled: () => refreshMediaReviews(queryClient, mediaItemId),
  });

  return useCallback(
    (review, pressed) =>
      runSignedIn(() =>
        mutate({ reviewId: review.id, vote: nextVote(review.currentUserVote, pressed) }),
      ),
    [mutate, runSignedIn],
  );
}
