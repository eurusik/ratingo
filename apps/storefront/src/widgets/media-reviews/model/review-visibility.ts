import { createIdSet } from '../lib/id-set';

export const reportedReviews = createIdSet();

export const reviewsBeingDeleted = createIdSet();

let reportsBelongTo: string | null = null;

export function resetReportedReviewsOnViewerChange(viewerId: string | null): void {
  if (viewerId === reportsBelongTo) return;
  reportsBelongTo = viewerId;
  reportedReviews.clear();
}
