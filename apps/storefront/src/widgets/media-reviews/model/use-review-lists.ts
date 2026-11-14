'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useAuth } from '@ratingo/web-core/auth';
import { reviewsApi, type Review, type ReviewPage, type ReviewSort } from '@/shared/api';
import { myReviewKey, reviewPagesKey, topReviewsKey } from './review-keys';
import { TOP_REVIEWS_QUERY, reviewPageQuery } from './review-queries';

const REVIEWS_STALE_MS = 60_000;

function useViewer() {
  const { user, isLoading, isAuthenticated } = useAuth();
  return { viewer: user?.id ?? null, isKnown: !isLoading, isAuthenticated };
}

function asSeed(viewer: string | null, initial: ReviewPage | null) {
  return viewer === null && initial ? initial : undefined;
}

export function useTopReviews(mediaItemId: string, initial: ReviewPage | null) {
  const { viewer, isKnown } = useViewer();
  return useQuery({
    queryKey: topReviewsKey(mediaItemId, viewer),
    queryFn: () => reviewsApi.listForMedia(mediaItemId, TOP_REVIEWS_QUERY),
    initialData: asSeed(viewer, initial),
    placeholderData: initial ?? undefined,
    enabled: isKnown,
    staleTime: REVIEWS_STALE_MS,
  });
}

export function useReviewPages(mediaItemId: string, sort: ReviewSort, initial: ReviewPage | null) {
  const { viewer, isKnown } = useViewer();
  const seed = asSeed(viewer, initial);
  return useInfiniteQuery({
    queryKey: reviewPagesKey(mediaItemId, sort, viewer),
    queryFn: ({ pageParam }) =>
      reviewsApi.listForMedia(mediaItemId, reviewPageQuery(sort, pageParam)),
    initialPageParam: 0,
    initialData: seed ? { pages: [seed], pageParams: [0] } : undefined,
    getNextPageParam: (lastPage, pages) => {
      const loaded = pages.reduce((count, page) => count + page.reviews.length, 0);
      return lastPage.reviews.length > 0 && loaded < lastPage.total ? loaded : undefined;
    },
    enabled: isKnown,
    staleTime: REVIEWS_STALE_MS,
    placeholderData: (previous) =>
      previous ?? (initial ? { pages: [initial], pageParams: [0] } : undefined),
  });
}

export function useMyReview(mediaItemId: string, listed: readonly Review[] = []) {
  const { viewer, isKnown, isAuthenticated } = useViewer();
  const listedMine = viewer ? listed.find((review) => review.author.id === viewer) : undefined;
  const query = useQuery({
    queryKey: myReviewKey(mediaItemId, viewer),
    queryFn: () => reviewsApi.getMine(mediaItemId),
    initialData: listedMine,
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
