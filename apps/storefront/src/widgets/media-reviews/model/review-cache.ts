import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { Review, ReviewPage } from '@/shared/api';
import { mediaReviewsKey } from './review-keys';

type CachedReviews = Review | ReviewPage | InfiniteData<ReviewPage> | null | undefined;
type ReviewUpdate = (review: Review) => Review;

function isInfinite(data: object): data is InfiniteData<ReviewPage> {
  return 'pages' in data;
}

function isPage(data: object): data is ReviewPage {
  return 'reviews' in data;
}

function updatePage(page: ReviewPage, reviewId: string, update: ReviewUpdate): ReviewPage {
  return {
    ...page,
    reviews: page.reviews.map((review) => (review.id === reviewId ? update(review) : review)),
  };
}

export function updateCachedReview(
  data: CachedReviews,
  reviewId: string,
  update: ReviewUpdate,
): CachedReviews {
  if (!data) return data;
  if (isInfinite(data)) {
    return { ...data, pages: data.pages.map((page) => updatePage(page, reviewId, update)) };
  }
  if (isPage(data)) return updatePage(data, reviewId, update);
  return data.id === reviewId ? update(data) : data;
}

function findCachedReview(data: CachedReviews, reviewId: string): Review | undefined {
  if (!data) return undefined;
  if (isInfinite(data)) {
    return data.pages.flatMap((page) => page.reviews).find((review) => review.id === reviewId);
  }
  if (isPage(data)) return data.reviews.find((review) => review.id === reviewId);
  return data.id === reviewId ? data : undefined;
}

export type RestoreReview = () => void;

export async function updateReviewEverywhere(
  queryClient: QueryClient,
  mediaItemId: string,
  reviewId: string,
  update: ReviewUpdate,
): Promise<RestoreReview> {
  const filters = { queryKey: mediaReviewsKey(mediaItemId) };
  await queryClient.cancelQueries(filters);
  const previous = queryClient
    .getQueriesData<CachedReviews>(filters)
    .map(([, data]) => findCachedReview(data, reviewId))
    .find((review) => review !== undefined);
  queryClient.setQueriesData<CachedReviews>(filters, (data) =>
    updateCachedReview(data, reviewId, update),
  );
  return () => {
    if (!previous) return;
    queryClient.setQueriesData<CachedReviews>(filters, (data) =>
      updateCachedReview(data, reviewId, () => previous),
    );
  };
}

export function refreshMediaReviewsAndWait(
  queryClient: QueryClient,
  mediaItemId: string,
): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: mediaReviewsKey(mediaItemId) });
}

export function refreshMediaReviews(queryClient: QueryClient, mediaItemId: string): void {
  void refreshMediaReviewsAndWait(queryClient, mediaItemId);
}
