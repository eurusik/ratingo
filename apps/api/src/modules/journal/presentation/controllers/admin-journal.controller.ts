/**
 * Admin Journal Controller
 *
 * Admin endpoints for managing journal posts (CRUD, publish/unpublish, image upload).
 * All endpoints require admin authentication.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import type { MultipartFile } from '@fastify/multipart';
import type { FastifyRequest } from 'fastify';

import { ValidationException } from '@/common/exceptions';

/**
 * Fastify request with multipart file method.
 * @fastify/multipart augments FastifyRequest at runtime.
 */
interface MultipartRequest extends FastifyRequest {
  file: () => Promise<MultipartFile | undefined>;
}

import { CurrentUser } from '../../../auth/infrastructure/decorators/current-user.decorator';
import { AdminJwtGuard } from '../../../auth/infrastructure/guards/admin-jwt.guard';
import { JournalImageService, type UploadedFile } from '../../application/journal-image.service';
import { generateExcerpt, renderMarkdownAsync } from '../../application/markdown-renderer';
import { validatePostState } from '../../application/post-state.validation';
import { ensureUniqueSlug, generateSlug } from '../../application/slug.utils';
import { JournalRepository } from '../../infrastructure/journal.repository';
import {
  AdminPostDto,
  AdminPostListResponseDto,
  AdminPostQueryDto,
  CreatePostDto,
  ImageUploadResponseDto,
  UpdatePostDto,
} from '../dto';

/**
 * Admin journal controller.
 * Provides CRUD operations for journal posts with admin authentication.
 */
@ApiTags('Admin - Journal')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('admin/journal/posts')
export class AdminJournalController {
  constructor(
    private readonly repository: JournalRepository,
    private readonly imageService: JournalImageService,
  ) {}

  /**
   * Returns paginated list of all posts (including drafts).
   *
   * @param query - Query parameters for filtering and pagination
   * @returns Paginated list of posts with admin details
   */
  @Get()
  @ApiOperation({
    summary: 'List all posts (admin)',
    description: 'Returns paginated list of all posts including drafts.',
  })
  @ApiOkResponse({
    type: AdminPostListResponseDto,
    description: 'Paginated list of posts',
  })
  async getPosts(@Query() query: AdminPostQueryDto): Promise<AdminPostListResponseDto> {
    const { posts, total } = await this.repository.findAll({
      page: query.page ?? 1,
      limit: query.limit ?? 10,
      status: query.status === 'scheduled' ? 'published' : query.status,
    });

    // Filter scheduled posts if needed
    const now = new Date();
    const filteredPosts =
      query.status === 'scheduled'
        ? posts.filter((p) => !p.isDraft && p.publishedAt && p.publishedAt > now)
        : posts;

    const totalPages = Math.ceil(total / (query.limit ?? 10));

    return {
      posts: filteredPosts.map((post) => this.mapToAdminDto(post)),
      meta: {
        total: query.status === 'scheduled' ? filteredPosts.length : total,
        page: query.page ?? 1,
        totalPages,
        limit: query.limit ?? 10,
      },
    };
  }

  /**
   * Returns a single post by ID (including drafts).
   *
   * @param id - Post UUID
   * @returns Full post details with admin info
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get post by ID (admin)',
    description: 'Returns full post details including draft content.',
  })
  @ApiParam({
    name: 'id',
    description: 'Post UUID',
    type: String,
  })
  @ApiOkResponse({
    type: AdminPostDto,
    description: 'Full post details',
  })
  async getPostById(@Param('id', ParseUUIDPipe) id: string): Promise<AdminPostDto> {
    const post = await this.repository.findById(id);

    if (!post) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }

    return this.mapToAdminDto(post);
  }

  /**
   * Creates a new journal post.
   *
   * @param dto - Post creation data
   * @param user - Current admin user
   * @returns Created post
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create new post',
    description: 'Creates a new journal post. Auto-generates slug from title if not provided.',
  })
  @ApiBody({ type: CreatePostDto })
  @ApiResponse({
    status: 201,
    description: 'Post created',
    type: AdminPostDto,
  })
  async createPost(
    @Body() dto: CreatePostDto,
    @CurrentUser() user: { id: string },
  ): Promise<AdminPostDto> {
    // Determine draft status and publication date
    const isDraft = dto.isDraft ?? true;
    const publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null;

    // Validate post state
    validatePostState(isDraft, publishedAt);

    // Generate or validate slug
    const baseSlug = dto.slug || (await generateSlug(dto.title));
    const slug = await ensureUniqueSlug(baseSlug, (s) => this.repository.existsBySlug(s));

    // Render markdown to HTML
    const bodyHtml = await renderMarkdownAsync(dto.body);
    const excerpt = await generateExcerpt(dto.body);

    const post = await this.repository.create({
      slug,
      title: dto.title,
      body: dto.body,
      bodyHtml,
      excerpt,
      type: dto.type,
      featuredImageUrl: dto.featuredImageUrl ?? null,
      contextId: dto.contextId ?? null,
      metaTitle: dto.metaTitle ?? null,
      metaDescription: dto.metaDescription ?? null,
      isDraft,
      publishedAt,
      authorId: user.id,
    });

    return this.mapToAdminDto(post);
  }

  /**
   * Updates an existing journal post.
   *
   * @param id - Post UUID
   * @param dto - Update data
   * @returns Updated post
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update post',
    description: 'Updates an existing journal post. Only provided fields are updated.',
  })
  @ApiParam({
    name: 'id',
    description: 'Post UUID',
    type: String,
  })
  @ApiBody({ type: UpdatePostDto })
  @ApiOkResponse({
    type: AdminPostDto,
    description: 'Updated post',
  })
  async updatePost(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
  ): Promise<AdminPostDto> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }

    // Determine final state values
    const isDraft = dto.isDraft ?? existing.isDraft;
    const publishedAt =
      dto.publishedAt !== undefined
        ? dto.publishedAt
          ? new Date(dto.publishedAt)
          : null
        : existing.publishedAt;

    // Validate post state
    validatePostState(isDraft, publishedAt);

    // Handle slug update
    let { slug } = existing;
    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.repository.existsBySlug(dto.slug, id);
      if (slugExists) {
        throw new ValidationException('Slug already exists', { slug: dto.slug });
      }
      slug = dto.slug;
    }

    // Re-render markdown if body changed
    let { bodyHtml } = existing;
    let { excerpt } = existing;
    if (dto.body && dto.body !== existing.body) {
      bodyHtml = await renderMarkdownAsync(dto.body);
      excerpt = await generateExcerpt(dto.body);
    }

    const updated = await this.repository.update(id, {
      slug,
      title: dto.title,
      body: dto.body,
      bodyHtml: dto.body ? bodyHtml : undefined,
      excerpt: dto.body ? excerpt : undefined,
      type: dto.type,
      featuredImageUrl: dto.featuredImageUrl,
      contextId: dto.contextId,
      metaTitle: dto.metaTitle,
      metaDescription: dto.metaDescription,
      isDraft,
      publishedAt,
    });

    if (!updated) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }

    return this.mapToAdminDto(updated);
  }

  /**
   * Deletes a journal post.
   *
   * @param id - Post UUID
   * @returns Success confirmation
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete post',
    description: 'Permanently deletes a journal post.',
  })
  @ApiParam({
    name: 'id',
    description: 'Post UUID',
    type: String,
  })
  @ApiOkResponse({
    description: 'Post deleted',
    schema: { type: 'object', properties: { success: { type: 'boolean' } } },
  })
  async deletePost(@Param('id', ParseUUIDPipe) id: string): Promise<{ success: boolean }> {
    const deleted = await this.repository.delete(id);

    if (!deleted) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }

    return { success: true };
  }

  /**
   * Publishes a draft post.
   *
   * @param id - Post UUID
   * @returns Published post
   */
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Publish post',
    description: 'Publishes a draft post immediately or at a scheduled time.',
  })
  @ApiParam({
    name: 'id',
    description: 'Post UUID',
    type: String,
  })
  @ApiOkResponse({
    type: AdminPostDto,
    description: 'Published post',
  })
  async publishPost(@Param('id', ParseUUIDPipe) id: string): Promise<AdminPostDto> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }

    if (!existing.isDraft) {
      throw new BadRequestException('Post is already published');
    }

    const updated = await this.repository.update(id, {
      isDraft: false,
      publishedAt: new Date(),
    });

    if (!updated) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }

    return this.mapToAdminDto(updated);
  }

  /**
   * Unpublishes a published post (converts to draft).
   *
   * @param id - Post UUID
   * @returns Unpublished post (now draft)
   */
  @Post(':id/unpublish')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Unpublish post',
    description: 'Converts a published post back to draft status.',
  })
  @ApiParam({
    name: 'id',
    description: 'Post UUID',
    type: String,
  })
  @ApiOkResponse({
    type: AdminPostDto,
    description: 'Unpublished post (draft)',
  })
  async unpublishPost(@Param('id', ParseUUIDPipe) id: string): Promise<AdminPostDto> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }

    if (existing.isDraft) {
      throw new BadRequestException('Post is already a draft');
    }

    const updated = await this.repository.update(id, {
      isDraft: true,
      publishedAt: null,
    });

    if (!updated) {
      throw new NotFoundException(`Post with ID "${id}" not found`);
    }

    return this.mapToAdminDto(updated);
  }

  /**
   * Uploads an image for use in journal posts.
   * Uses multipart/form-data with a 'file' field.
   *
   * @param req - Fastify request with multipart data
   * @returns CDN URL of uploaded image
   */
  @Post('upload-image')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Upload image',
    description: 'Uploads an image for use in journal posts. Returns CDN URL.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (jpg, png, webp, gif). Max 5MB.',
        },
      },
      required: ['file'],
    },
  })
  @ApiOkResponse({
    type: ImageUploadResponseDto,
    description: 'Uploaded image URL',
  })
  async uploadImage(@Req() req: MultipartRequest): Promise<ImageUploadResponseDto> {
    // Parse multipart data from Fastify request
    const data = await req.file();

    if (!data) {
      throw new BadRequestException('No file uploaded');
    }

    // Convert to buffer
    const buffer = await data.toBuffer();

    const file: UploadedFile = {
      mimetype: data.mimetype,
      size: buffer.length,
      buffer,
      filename: data.filename,
    };

    const key = await this.imageService.uploadImage(file);

    // Return proxy URL instead of direct S3 URL
    // Images are served via /api/journal/images/:filename
    const filename = this.imageService.getFilenameFromKey(key);
    const url = `/api/journal/images/${filename}`;

    return { url };
  }

  /**
   * Maps a JournalPost to AdminPostDto.
   */
  private mapToAdminDto(post: {
    id: string;
    slug: string;
    title: string;
    body: string;
    bodyHtml: string;
    excerpt: string;
    type: string;
    featuredImageUrl: string | null;
    contextId: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
    isDraft: boolean;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    authorId: string;
  }): AdminPostDto {
    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      type: post.type as AdminPostDto['type'],
      featuredImageUrl: post.featuredImageUrl,
      publishedAt: post.publishedAt!,
      createdAt: post.createdAt,
      body: post.body,
      bodyHtml: post.bodyHtml,
      contextId: post.contextId,
      metaTitle: post.metaTitle,
      metaDescription: post.metaDescription,
      updatedAt: post.updatedAt,
      navigation: { prev: null, next: null },
      isDraft: post.isDraft,
      authorId: post.authorId,
    };
  }
}
