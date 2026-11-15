import type { ReviewSort } from '@/shared/api';

const REVIEWS_QUERY_KEY = ['reviews'] as const;

type Viewer = string | null;

export function mediaReviewsKey(mediaItemId: string) {
  return [...REVIEWS_QUERY_KEY, 'media', mediaItemId] as const;
}

export function topReviewsKey(mediaItemId: string, viewer: Viewer) {
  return [...mediaReviewsKey(mediaItemId), 'top', viewer] as const;
}

export function reviewPagesKey(mediaItemId: string, sort: ReviewSort, viewer: Viewer) {
  return [...mediaReviewsKey(mediaItemId), 'pages', sort, viewer] as const;
}

export function myReviewKey(mediaItemId: string, viewer: Viewer) {
  return [...mediaReviewsKey(mediaItemId), 'mine', viewer] as const;
}

export function repliesKey(reviewId: string) {
  return [...REVIEWS_QUERY_KEY, 'replies', reviewId] as const;
}
