/**
 * Public Journal Posts Controller
 *
 * Public endpoints for browsing and reading journal posts.
 * Supports filtering by type, pagination, and context-based queries.
 */

import { Controller, Get, Header, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { JournalRepository } from '../../infrastructure/journal.repository';
import {
  PostDetailDto,
  PostListItemDto,
  PostListResponseDto,
  PostNavigationDto,
  PostQueryDto,
} from '../dto';

/**
 * Public journal posts controller.
 * Provides read-only access to published journal posts.
 */
@ApiTags('Public: Journal')
@Controller('journal/posts')
export class JournalPostsController {
  constructor(private readonly repository: JournalRepository) {}

  /**
   * Returns paginated list of published journal posts.
   * Supports filtering by type (comma-separated for multi-type) and context.
   *
   * @param query - Query parameters for filtering and pagination
   * @returns Paginated list of posts with metadata
   */
  @Get()
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({
    summary: 'List journal posts',
    description:
      'Returns paginated list of published journal posts. ' +
      'Supports filtering by type (comma-separated for union) and context.',
  })
  @ApiOkResponse({
    type: PostListResponseDto,
    description: 'Paginated list of posts',
  })
  async getPosts(@Query() query: PostQueryDto): Promise<PostListResponseDto> {
    const { posts, total } = await this.repository.findPublished({
      types: query.type,
      contextId: query.context,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    });

    const totalPages = Math.ceil(total / (query.limit ?? 10));

    return {
      posts: posts.map((post) => this.mapToListItem(post)),
      meta: {
        total,
        page: query.page ?? 1,
        totalPages,
        limit: query.limit ?? 10,
      },
    };
  }

  /**
   * Returns a single published post by slug with navigation links.
   *
   * @param slug - Post URL slug
   * @returns Full post details with prev/next navigation
   */
  @Get(':slug')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({
    summary: 'Get post by slug',
    description: 'Returns full post details including rendered HTML and navigation links.',
  })
  @ApiParam({
    name: 'slug',
    description: 'Post URL slug',
    example: 'shcho-novoho-v-ratingo',
  })
  @ApiOkResponse({
    type: PostDetailDto,
    description: 'Full post details with navigation',
  })
  async getPostBySlug(@Param('slug') slug: string): Promise<PostDetailDto> {
    const post = await this.repository.findBySlug(slug);

    if (!post) {
      throw new NotFoundException(`Post with slug "${slug}" not found`);
    }

    const navigation = await this.repository.getNavigation(post);

    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      type: post.type,
      featuredImageUrl: post.featuredImageUrl,
      publishedAt: post.publishedAt!,
      createdAt: post.createdAt,
      body: post.body,
      bodyHtml: post.bodyHtml,
      contextId: post.contextId,
      metaTitle: post.metaTitle,
      metaDescription: post.metaDescription,
      updatedAt: post.updatedAt,
      navigation: this.mapNavigation(navigation),
    };
  }

  /**
   * Maps a JournalPost to PostListItemDto.
   */
  private mapToListItem(post: {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    type: string;
    featuredImageUrl: string | null;
    publishedAt: Date | null;
    createdAt: Date;
  }): PostListItemDto {
    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      type: post.type as PostListItemDto['type'],
      featuredImageUrl: post.featuredImageUrl,
      publishedAt: post.publishedAt!,
      createdAt: post.createdAt,
    };
  }

  /**
   * Maps PostNavigation to PostNavigationDto.
   */
  private mapNavigation(navigation: {
    prev: { slug: string; title: string } | null;
    next: { slug: string; title: string } | null;
  }): PostNavigationDto {
    return {
      prev: navigation.prev,
      next: navigation.next,
    };
  }
}
