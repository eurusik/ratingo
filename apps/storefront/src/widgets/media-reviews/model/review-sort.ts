import type { ReviewSort } from '@/shared/api';

export const REVIEW_SORTS = ['most_liked', 'newest', 'oldest'] as const satisfies ReviewSort[];

const DEFAULT_REVIEW_SORT: ReviewSort = 'most_liked';

export const REVIEW_SORT_PARAM = 'sort';

export function parseReviewSort(value: string | null | undefined): ReviewSort {
  return REVIEW_SORTS.find((sort) => sort === value) ?? DEFAULT_REVIEW_SORT;
}

export function reviewSortSearch(sort: ReviewSort): string {
  return sort === DEFAULT_REVIEW_SORT ? '' : `?${REVIEW_SORT_PARAM}=${sort}`;
}
