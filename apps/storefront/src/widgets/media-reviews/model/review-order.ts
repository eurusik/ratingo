import type { Review } from '@/shared/api';

export function withOwnReviewFirst(
  mine: Review | null | undefined,
  others: readonly Review[],
  hidden: ReadonlySet<string>,
): Review[] {
  const rest = others.filter((review) => review.id !== mine?.id);
  const ordered = mine ? [mine, ...rest] : rest;
  return ordered.filter((review) => !hidden.has(review.id));
}
