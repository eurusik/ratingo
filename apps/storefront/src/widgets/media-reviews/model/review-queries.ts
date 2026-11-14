import type { ReviewSort } from '@/shared/api';

export const TOP_REVIEWS_SHOWN = 3;
const REVIEWS_PAGE_SIZE = 10;

export const TOP_REVIEWS_QUERY = {
  sort: 'most_liked',
  limit: TOP_REVIEWS_SHOWN + 1,
  offset: 0,
} as const satisfies { sort: ReviewSort; limit: number; offset: number };

export function reviewPageQuery(sort: ReviewSort, offset: number) {
  return { sort, limit: REVIEWS_PAGE_SIZE, offset };
}
