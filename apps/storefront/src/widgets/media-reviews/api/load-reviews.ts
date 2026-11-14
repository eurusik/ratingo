import { cache } from 'react';
import { reviewsApi, type CatalogCache, type ReviewPage, type ReviewSort } from '@/shared/api';
import { TOP_REVIEWS_QUERY, reviewPageQuery } from '../model/review-queries';

const REVIEWS_CACHE: CatalogCache = { revalidateSeconds: 60 };

async function orNullOnFailure(
  mediaItemId: string,
  load: () => Promise<ReviewPage>,
): Promise<ReviewPage | null> {
  try {
    return await load();
  } catch (error) {
    console.error('Loading reviews on the server failed', { mediaItemId, error });
    return null;
  }
}

export const loadTopReviews = cache((mediaItemId: string) =>
  orNullOnFailure(mediaItemId, () =>
    reviewsApi.listForMedia(mediaItemId, TOP_REVIEWS_QUERY, REVIEWS_CACHE),
  ),
);

export const loadFirstReviewPage = cache((mediaItemId: string, sort: ReviewSort) =>
  orNullOnFailure(mediaItemId, () =>
    reviewsApi.listForMedia(mediaItemId, reviewPageQuery(sort, 0), REVIEWS_CACHE),
  ),
);
