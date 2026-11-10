import type { components } from '@ratingo/api-contract';

export type PostDetailDto = components['schemas']['PostDetailDto'];

export type AdminPostDto = components['schemas']['AdminPostDto'];

export type PostListResponseDto = components['schemas']['PostListResponseDto'];

export type AdminPostListResponseDto = components['schemas']['AdminPostListResponseDto'];

export type CreatePostDto = components['schemas']['CreatePostDto'];

export type UpdatePostDto = components['schemas']['UpdatePostDto'];

export type ImageUploadResponseDto = components['schemas']['ImageUploadResponseDto'];

export const POST_TYPE_VALUES = ['update', 'explanation', 'fix', 'roadmap'] as const;

export type PostType = (typeof POST_TYPE_VALUES)[number];

export type PostStatus = 'draft' | 'published' | 'scheduled';

export interface PostsQueryParams {
  type?: PostType[];
  context?: string;
  page?: number;
  limit?: number;
}

export interface AdminPostsQueryParams extends PostsQueryParams {
  status?: PostStatus;
}
