'use client';

import { useEffect } from 'react';
import { useAuth } from '@ratingo/web-core/auth';
import type { Review } from '@/shared/api';
import { takePendingIntent } from '@/shared/auth';
import type { useMyReview } from './use-review-lists';

type ViewerReview = Pick<ReturnType<typeof useMyReview>, 'mine' | 'isResolving'>;

export function useComposeAfterSignIn(
  mediaItemId: string,
  { mine, isResolving }: ViewerReview,
  openCompose: (editing?: Review) => void,
): void {
  const { isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isLoading || !isAuthenticated || isResolving) return;
    const intent = takePendingIntent('review');
    if (intent?.mediaItemId === mediaItemId) openCompose(mine ?? undefined);
  }, [isLoading, isAuthenticated, isResolving, mediaItemId, mine, openCompose]);
}
