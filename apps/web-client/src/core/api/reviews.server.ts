/**
 * Server-side reviews API helpers.
 * Uses ky for consistency, with Next.js fetch options for caching.
 */

import ky from 'ky';
import { env } from '../config/env';
import type { ApiErrorDetail } from './error';
import { REVIEWS_DEFAULTS, type ReviewListResponseDto, type ReviewSort } from './reviews.client';

/** Server-side ky instance without auth (for public endpoints). */
const serverApi = ky.create({
  prefixUrl: env.API_BASE_URL,
  timeout: 15000,
  retry: {
    limit: 2,
    statusCodes: [408, 500, 502, 503, 504],
  },
});

/** API response wrapper. */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorDetail;
}

interface GetReviewsParams {
  mediaItemId: string;
  sort?: ReviewSort;
  limit?: number;
}

/**
 * Fetches reviews for a media item on the server.
 * For use in Server Components for SSR.
 */
export async function getReviewsForMedia(
  params: GetReviewsParams,
): Promise<ReviewListResponseDto | null> {
  try {
    const { mediaItemId, sort = REVIEWS_DEFAULTS.SORT, limit = REVIEWS_DEFAULTS.LIMIT } = params;

    const searchParams: Record<string, string | number> = {
      sort,
      limit,
    };

    const response = await serverApi
      .get(`reviews/media/${mediaItemId}`, {
        searchParams,
        fetch: (input, init) => fetch(input, { ...init, next: { revalidate: 60 } }),
      })
      .json<ApiResponse<ReviewListResponseDto>>();

    if (!response.success || !response.data) {
      console.error('Reviews API error:', response.error);
      return null;
    }

    return response.data;
  } catch (error) {
    console.error('Failed to fetch reviews:', error);
    return null;
  }
}
