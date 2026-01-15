/**
 * Journal API client.
 *
 * Provides typed methods for journal endpoints.
 */

import type {
  PostListResponseDto,
  PostDetailDto,
  AdminPostListResponseDto,
  AdminPostDto,
  CreatePostDto,
  UpdatePostDto,
  ImageUploadResponseDto,
  PostsQueryParams,
  AdminPostsQueryParams,
} from '@/modules/journal/types';

import { apiGet, apiPost, apiPatch, apiDelete } from './client';
import { getApiUrl } from '../config/env';
import { tokenStorage } from '../auth/token-storage';

/**
 * Builds search params from query object.
 * Handles array params (type) by joining with comma.
 */
function buildSearchParams(
  params: PostsQueryParams | AdminPostsQueryParams,
): Record<string, string | number> {
  const result: Record<string, string | number> = {};

  if (params.page) result.page = params.page;
  if (params.limit) result.limit = params.limit;
  if (params.context) result.context = params.context;
  if (params.type && params.type.length > 0) {
    result.type = params.type.join(',');
  }
  if ('status' in params && params.status) {
    result.status = params.status;
  }

  return result;
}

/**
 * Journal API client for public and admin endpoints.
 */
export const journalApi = {
  // ===========================================================================
  // Public Endpoints
  // ===========================================================================

  /**
   * Fetches paginated list of published posts.
   *
   * @param params - Query parameters (type filter, pagination)
   * @returns Paginated posts response
   *
   * @example
   * const posts = await journalApi.getPosts({ type: ['update'], page: 1, limit: 10 });
   */
  async getPosts(params: PostsQueryParams = {}): Promise<PostListResponseDto> {
    return apiGet<PostListResponseDto>('journal/posts', {
      searchParams: buildSearchParams(params),
    });
  },

  /**
   * Fetches a single post by slug.
   *
   * @param slug - Post URL slug
   * @returns Post detail with navigation
   *
   * @example
   * const post = await journalApi.getPost('shcho-novoho-v-ratingo');
   */
  async getPost(slug: string): Promise<PostDetailDto> {
    return apiGet<PostDetailDto>(`journal/posts/${slug}`);
  },

  // ===========================================================================
  // Admin Endpoints
  // ===========================================================================

  /**
   * Fetches paginated list of all posts (admin).
   *
   * @param params - Query parameters (type filter, status filter, pagination)
   * @returns Admin paginated posts response
   */
  async getAdminPosts(params: AdminPostsQueryParams = {}): Promise<AdminPostListResponseDto> {
    return apiGet<AdminPostListResponseDto>('admin/journal/posts', {
      searchParams: buildSearchParams(params),
    });
  },

  /**
   * Fetches a single post by ID (admin).
   *
   * @param id - Post UUID
   * @returns Admin post detail
   */
  async getAdminPost(id: string): Promise<AdminPostDto> {
    return apiGet<AdminPostDto>(`admin/journal/posts/${id}`);
  },

  /**
   * Creates a new post (admin).
   *
   * @param data - Post creation data
   * @returns Created post
   */
  async createPost(data: CreatePostDto): Promise<AdminPostDto> {
    return apiPost<AdminPostDto>('admin/journal/posts', data);
  },

  /**
   * Updates an existing post (admin).
   *
   * @param id - Post UUID
   * @param data - Post update data
   * @returns Updated post
   */
  async updatePost(id: string, data: UpdatePostDto): Promise<AdminPostDto> {
    return apiPatch<AdminPostDto>(`admin/journal/posts/${id}`, data);
  },

  /**
   * Deletes a post (admin).
   *
   * @param id - Post UUID
   */
  async deletePost(id: string): Promise<void> {
    return apiDelete<void>(`admin/journal/posts/${id}`);
  },

  /**
   * Publishes a draft post (admin).
   *
   * @param id - Post UUID
   * @returns Published post
   */
  async publishPost(id: string): Promise<AdminPostDto> {
    return apiPost<AdminPostDto>(`admin/journal/posts/${id}/publish`);
  },

  /**
   * Unpublishes a post (admin).
   *
   * @param id - Post UUID
   * @returns Unpublished post (now draft)
   */
  async unpublishPost(id: string): Promise<AdminPostDto> {
    return apiPost<AdminPostDto>(`admin/journal/posts/${id}/unpublish`);
  },

  /**
   * Uploads an image for use in posts (admin).
   *
   * @param file - Image file to upload
   * @param onProgress - Optional progress callback (0-100)
   * @returns Uploaded image URL
   */
  async uploadImage(
    file: File,
    onProgress?: (percent: number) => void,
  ): Promise<ImageUploadResponseDto> {
    const formData = new FormData();
    formData.append('file', file);

    const token = tokenStorage.getAccessToken();
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(getApiUrl('admin/journal/posts/upload-image'), {
      method: 'POST',
      body: formData,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error?.message || 'Upload failed');
    }

    // Call progress callback with 100% when done
    onProgress?.(100);

    return result.data;
  },
} as const;
