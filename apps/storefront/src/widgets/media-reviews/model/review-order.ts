import type { Review } from '@/shared/api';
import { TOP_REVIEWS_SHOWN } from './review-queries';

export function topOthers(listed: readonly Review[], mineId: string | undefined): Review[] {
  const others = listed.filter((review) => review.id !== mineId);
  return others.slice(0, mineId ? TOP_REVIEWS_SHOWN - 1 : TOP_REVIEWS_SHOWN);
}

export function withOwnReviewFirst(
  mine: Review | null | undefined,
  others: readonly Review[],
  hidden: ReadonlySet<string>,
): Review[] {
  const rest = others.filter((review) => review.id !== mine?.id);
  const ordered = mine ? [mine, ...rest] : rest;
  return ordered.filter((review) => !hidden.has(review.id));
}
