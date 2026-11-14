'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { reviewsApi, type Review } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { showUndoToast } from '@/shared/lib';
import { refreshMediaReviews } from './review-cache';
import { reviewsBeingDeleted } from './review-visibility';

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
