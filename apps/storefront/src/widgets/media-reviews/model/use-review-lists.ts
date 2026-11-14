'use client';

import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAuth } from '@ratingo/web-core/auth';
import { reviewsApi, type ReviewSort } from '@/shared/api';
import { myReviewKey, reviewPagesKey, topReviewsKey } from './review-keys';

export const TOP_REVIEWS_SHOWN = 3;
const REVIEWS_PAGE_SIZE = 10;
const REVIEWS_STALE_MS = 60_000;

function useViewer() {
  const { user, isLoading, isAuthenticated } = useAuth();
  return { viewer: user?.id ?? null, isKnown: !isLoading, isAuthenticated };
}

export function useTopReviews(mediaItemId: string) {
  const { viewer, isKnown } = useViewer();
  return useQuery({
    queryKey: topReviewsKey(mediaItemId, viewer),
    queryFn: () =>
      reviewsApi.listForMedia(mediaItemId, {
        sort: 'most_liked',
        limit: TOP_REVIEWS_SHOWN + 1,
        offset: 0,
      }),
    enabled: isKnown,
    staleTime: REVIEWS_STALE_MS,
  });
}

export function useReviewPages(mediaItemId: string, sort: ReviewSort) {
  const { viewer, isKnown } = useViewer();
  return useInfiniteQuery({
    queryKey: reviewPagesKey(mediaItemId, sort, viewer),
    queryFn: ({ pageParam }) =>
      reviewsApi.listForMedia(mediaItemId, {
        sort,
        limit: REVIEWS_PAGE_SIZE,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((count, page) => count + page.reviews.length, 0);
      return lastPage.reviews.length > 0 && loaded < lastPage.total ? loaded : undefined;
    },
    enabled: isKnown,
    staleTime: REVIEWS_STALE_MS,
    placeholderData: keepPreviousData,
  });
}

export function useMyReview(mediaItemId: string) {
  const { viewer, isKnown, isAuthenticated } = useViewer();
  const query = useQuery({
    queryKey: myReviewKey(mediaItemId, viewer),
    queryFn: () => reviewsApi.getMine(mediaItemId),
    enabled: isAuthenticated,
    staleTime: REVIEWS_STALE_MS,
  });
  return {
    mine: isAuthenticated ? (query.data ?? null) : null,
    isResolving: !isKnown || (isAuthenticated && query.isPending),
    isError: isAuthenticated && query.isError,
    retry: () => void query.refetch(),
  };
}
