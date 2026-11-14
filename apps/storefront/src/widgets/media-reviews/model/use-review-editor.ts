'use client';

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { ErrorCode, getApiErrorCode } from '@ratingo/web-core/api';
import { useMediaStateStore } from '@/entities/library';
import { reviewsApi, type Review, type ReviewDraft } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { showUndoToast } from '@/shared/lib';
import { refreshMediaReviews } from './review-cache';
import { mediaReviewsKey } from './review-keys';
import { reviewsBeingDeleted } from './hidden-reviews';
import type { ReviewedMedia } from './reviewed-media';

type PublishFailure = 'exists' | 'failed';

export class ReviewPublishError extends Error {
  constructor(readonly failure: PublishFailure) {
    super(`Review was not published: ${failure}`);
  }
}

async function publishFailureOf(error: unknown): Promise<PublishFailure> {
  return (await getApiErrorCode(error)) === ErrorCode.REVIEW_ALREADY_EXISTS ? 'exists' : 'failed';
}

interface Publication {
  draft: ReviewDraft;
  editing: Review | null;
}

export function usePublishReview(media: ReviewedMedia) {
  const { dict } = useTranslation();
  const queryClient = useQueryClient();
  const mediaState = useMediaStateStore();

  return useMutation<unknown, ReviewPublishError, Publication>({
    mutationFn: async ({ draft, editing }) => {
      try {
        return editing
          ? await reviewsApi.update(editing.id, draft)
          : await reviewsApi.create(media.mediaItemId, media.type, draft);
      } catch (error) {
        console.error('Publishing a review failed', { mediaItemId: media.mediaItemId, error });
        throw new ReviewPublishError(await publishFailureOf(error));
      }
    },
    onSuccess: async (_review, { editing }) => {
      mediaState.refresh(media.mediaItemId);
      await queryClient.invalidateQueries({ queryKey: mediaReviewsKey(media.mediaItemId) });
      toast.success(editing ? dict.reviews.toast.saved : dict.reviews.toast.published);
    },
  });
}

export function useDeleteReview(mediaItemId: string): (review: Review) => void {
  const { dict } = useTranslation();
  const queryClient = useQueryClient();

  const { deleted, undo, deleteFailed } = dict.reviews.toast;

  return useCallback(
    (review) => {
      const deleteForGood = async () => {
        try {
          await reviewsApi.delete(review.id);
          refreshMediaReviews(queryClient, mediaItemId);
        } catch (error) {
          console.error('Deleting a review failed', { reviewId: review.id, error });
          reviewsBeingDeleted.remove(review.id);
          toast.danger(deleteFailed);
        }
      };
      reviewsBeingDeleted.add(review.id);
      showUndoToast({
        key: `review-delete:${review.id}`,
        message: deleted,
        undoLabel: undo,
        onUndo: () => reviewsBeingDeleted.remove(review.id),
        onKept: () => void deleteForGood(),
      });
    },
    [queryClient, mediaItemId, deleted, undo, deleteFailed],
  );
}
