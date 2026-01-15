/**
 * Server-side journal API helpers.
 * Uses ky for consistency, with Next.js fetch options for caching.
 */

import ky from 'ky';
import { env } from '../config/env';
import type { ApiErrorDetail } from './error';
import type { PostListResponseDto, PostDetailDto, PostsQueryParams } from '@/modules/journal/types';

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

/**
 * Fetches journal posts on the server.
 * For use in Server Components and generateStaticParams.
 */
export async function getJournalPosts(
  params: PostsQueryParams = {},
): Promise<PostListResponseDto | null> {
  try {
    const searchParams: Record<string, string | number> = {};

    if (params.page) searchParams.page = params.page;
    if (params.limit) searchParams.limit = params.limit;
    if (params.type && params.type.length > 0) {
      searchParams.type = params.type.join(',');
    }

    const response = await serverApi
      .get('journal/posts', {
        searchParams,
        fetch: (input, init) =>
          fetch(input, { ...init, next: { revalidate: 60 } }), // Next.js ISR
      })
      .json<ApiResponse<PostListResponseDto>>();

    if (!response.success || !response.data) {
      console.error('Journal API error:', response.error);
      return null;
    }

    return response.data;
  } catch (error) {
    console.error('Failed to fetch journal posts:', error);
    return null;
  }
}

/**
 * Fetches a single journal post by slug on the server.
 * For use in Server Components.
 */
export async function getJournalPost(slug: string): Promise<PostDetailDto | null> {
  try {
    const response = await serverApi
      .get(`journal/posts/${slug}`, {
        fetch: (input, init) =>
          fetch(input, { ...init, next: { revalidate: 600 } }), // ISR 10 min
      })
      .json<ApiResponse<PostDetailDto>>();

    if (!response.success || !response.data) {
      console.error('Journal API error:', response.error);
      return null;
    }

    return response.data;
  } catch (error) {
    console.error('Failed to fetch journal post:', error);
    return null;
  }
}
