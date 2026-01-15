import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { POST_TYPE_VALUES, PostType } from '../../domain/constants/post-types';

/**
 * Navigation link to adjacent post.
 */
export class PostNavigationLinkDto {
  @ApiProperty({ description: 'Post slug', example: 'shcho-novoho-v-ratingo' })
  slug: string;

  @ApiProperty({ description: 'Post title', example: 'Що нового в Ratingo' })
  title: string;
}

/**
 * Navigation links for post detail view.
 */
export class PostNavigationDto {
  @ApiPropertyOptional({
    description: 'Previous post (older)',
    type: PostNavigationLinkDto,
    nullable: true,
  })
  prev: PostNavigationLinkDto | null;

  @ApiPropertyOptional({
    description: 'Next post (newer)',
    type: PostNavigationLinkDto,
    nullable: true,
  })
  next: PostNavigationLinkDto | null;
}

/**
 * Response DTO for journal post in list view.
 */
export class PostListItemDto {
  @ApiProperty({
    description: 'Post ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'URL slug',
    example: 'shcho-novoho-v-ratingo',
  })
  slug: string;

  @ApiProperty({
    description: 'Post title',
    example: 'Що нового в Ratingo',
  })
  title: string;

  @ApiProperty({
    description: 'Post excerpt (first 200 chars of body)',
    example: 'Ми додали нові функції для покращення вашого досвіду...',
  })
  excerpt: string;

  @ApiProperty({
    description: 'Post type',
    enum: POST_TYPE_VALUES,
    example: 'update',
  })
  type: PostType;

  @ApiPropertyOptional({
    description: 'Featured image URL',
    example: 'https://cdn.ratingo.com/journal/featured.jpg',
    nullable: true,
  })
  featuredImageUrl: string | null;

  @ApiProperty({
    description: 'Publication date',
    example: '2026-01-15T10:00:00.000Z',
  })
  publishedAt: Date;

  @ApiProperty({
    description: 'Creation date',
    example: '2026-01-14T15:30:00.000Z',
  })
  createdAt: Date;
}

/**
 * Response DTO for full journal post detail.
 */
export class PostDetailDto extends PostListItemDto {
  @ApiProperty({
    description: 'Post body in Markdown format',
    example: '## Нові функції\n\nМи додали...',
  })
  body: string;

  @ApiProperty({
    description: 'Rendered HTML content',
    example: '<h2>Нові функції</h2><p>Ми додали...</p>',
  })
  bodyHtml: string;

  @ApiPropertyOptional({
    description: 'Context identifier',
    example: 'trending',
    nullable: true,
  })
  contextId: string | null;

  @ApiPropertyOptional({
    description: 'Meta title for SEO',
    example: 'Що нового в Ratingo | Журнал',
    nullable: true,
  })
  metaTitle: string | null;

  @ApiPropertyOptional({
    description: 'Meta description for SEO',
    example: 'Дізнайтеся про останні оновлення Ratingo...',
    nullable: true,
  })
  metaDescription: string | null;

  @ApiProperty({
    description: 'Last update date',
    example: '2026-01-15T12:00:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'Navigation links to adjacent posts',
    type: PostNavigationDto,
  })
  navigation: PostNavigationDto;
}

/**
 * Response DTO for admin post view (includes draft info).
 */
export class AdminPostDto extends PostDetailDto {
  @ApiProperty({
    description: 'Whether post is a draft',
    example: false,
  })
  isDraft: boolean;

  @ApiProperty({
    description: 'Author user ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  authorId: string;
}

/**
 * Pagination metadata for post list response.
 */
export class PostPaginationMetaDto {
  @ApiProperty({ description: 'Total number of posts', example: 42 })
  total: number;

  @ApiProperty({ description: 'Current page number', example: 1 })
  page: number;

  @ApiProperty({ description: 'Total number of pages', example: 5 })
  totalPages: number;

  @ApiProperty({ description: 'Posts per page', example: 10 })
  limit: number;
}

/**
 * Paginated response for journal posts list.
 */
export class PostListResponseDto {
  @ApiProperty({
    description: 'List of posts',
    type: [PostListItemDto],
  })
  posts: PostListItemDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PostPaginationMetaDto,
  })
  meta: PostPaginationMetaDto;
}

/**
 * Paginated response for admin journal posts list.
 */
export class AdminPostListResponseDto {
  @ApiProperty({
    description: 'List of posts with admin details',
    type: [AdminPostDto],
  })
  posts: AdminPostDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: PostPaginationMetaDto,
  })
  meta: PostPaginationMetaDto;
}

/**
 * Response for image upload endpoint.
 */
export class ImageUploadResponseDto {
  @ApiProperty({
    description: 'CDN URL of uploaded image',
    example: 'https://cdn.ratingo.com/journal/abc123.jpg',
  })
  url: string;
}
