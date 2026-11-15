'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@heroui/react';
import { ErrorCode, getApiErrorCode } from '@ratingo/web-core/api';
import { useMediaStateStore } from '@/entities/library';
import { reviewsApi, type Review, type ReviewDraft } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { refreshMediaReviewsAndWait } from './review-cache';
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
      await refreshMediaReviewsAndWait(queryClient, media.mediaItemId);
      toast.success(editing ? dict.reviews.toast.saved : dict.reviews.toast.published);
    },
  });
}
