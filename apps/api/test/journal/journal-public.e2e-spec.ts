/**
 * Journal Public Endpoints E2E Tests
 *
 * Tests for public journal endpoints:
 * - GET /journal/posts - paginated list with filtering
 * - GET /journal/posts/:slug - single post with navigation
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';

import { AllExceptionsFilter } from '../../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../src/common/interceptors/response.interceptor';
import authConfig from '../../src/config/auth.config';
import { DATABASE_CONNECTION } from '../../src/database/database.module';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { REFRESH_TOKENS_REPOSITORY } from '../../src/modules/auth/domain/repositories/refresh-tokens.repository.interface';
import { JournalImageService } from '../../src/modules/journal/application/journal-image.service';
import { PostType } from '../../src/modules/journal/domain/constants/post-types';
import {
  JournalPost,
  PostNavigation,
} from '../../src/modules/journal/domain/interfaces/journal-post.interface';
import {
  CreateJournalPostData,
  FindPublishedFilters,
  JournalRepository,
  PaginatedPostsResult,
  UpdateJournalPostData,
} from '../../src/modules/journal/infrastructure/journal.repository';
import { JournalModule } from '../../src/modules/journal/journal.module';
import { USERS_REPOSITORY } from '../../src/modules/users/domain/repositories/users.repository.interface';
import { UsersModule } from '../../src/modules/users/users.module';
import { InMemoryRefreshTokensRepository, InMemoryUsersRepository } from '../users/_fakes';

/**
 * In-memory journal repository for testing.
 */
class InMemoryJournalRepository {
  private posts: JournalPost[] = [];
  private idCounter = 0;

  async findPublished(filters: FindPublishedFilters): Promise<PaginatedPostsResult> {
    const now = new Date();
    let filtered = this.posts.filter((p) => !p.isDraft && p.publishedAt && p.publishedAt <= now);

    // Type filter
    if (filters.types?.length) {
      filtered = filtered.filter((p) => filters.types!.includes(p.type));
    }

    // Context filter
    if (filters.contextId) {
      filtered = filtered.filter((p) => p.contextId === filters.contextId);
    }

    // Sort by publishedAt DESC, createdAt DESC
    filtered.sort((a, b) => {
      const pubDiff = (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
      if (pubDiff !== 0) return pubDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    const total = filtered.length;
    const offset = (filters.page - 1) * filters.limit;
    const posts = filtered.slice(offset, offset + filters.limit);

    return { posts, total };
  }

  async findBySlug(slug: string): Promise<JournalPost | null> {
    const now = new Date();
    return (
      this.posts.find(
        (p) => p.slug === slug && !p.isDraft && p.publishedAt && p.publishedAt <= now,
      ) ?? null
    );
  }

  async findById(id: string): Promise<JournalPost | null> {
    return this.posts.find((p) => p.id === id) ?? null;
  }

  async findByContext(contextId: string): Promise<JournalPost | null> {
    const now = new Date();
    const filtered = this.posts
      .filter(
        (p) => p.contextId === contextId && !p.isDraft && p.publishedAt && p.publishedAt <= now,
      )
      .sort((a, b) => {
        const pubDiff = (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
        if (pubDiff !== 0) return pubDiff;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
    return filtered[0] ?? null;
  }

  async existsBySlug(slug: string, excludeId?: string): Promise<boolean> {
    return this.posts.some((p) => p.slug === slug && p.id !== excludeId);
  }

  async create(data: CreateJournalPostData): Promise<JournalPost> {
    this.idCounter++;
    const post: JournalPost = {
      id: `post-${this.idCounter}`,
      slug: data.slug,
      title: data.title,
      body: data.body,
      bodyHtml: data.bodyHtml,
      excerpt: data.excerpt,
      type: data.type,
      featuredImageUrl: data.featuredImageUrl ?? null,
      contextId: data.contextId ?? null,
      metaTitle: data.metaTitle ?? null,
      metaDescription: data.metaDescription ?? null,
      isDraft: data.isDraft,
      publishedAt: data.publishedAt ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
      authorId: data.authorId,
    };
    this.posts.push(post);
    return post;
  }

  async update(id: string, data: UpdateJournalPostData): Promise<JournalPost | null> {
    const post = this.posts.find((p) => p.id === id);
    if (!post) return null;

    if (data.slug !== undefined) post.slug = data.slug;
    if (data.title !== undefined) post.title = data.title;
    if (data.body !== undefined) post.body = data.body;
    if (data.bodyHtml !== undefined) post.bodyHtml = data.bodyHtml;
    if (data.excerpt !== undefined) post.excerpt = data.excerpt;
    if (data.type !== undefined) post.type = data.type;
    if (data.featuredImageUrl !== undefined) post.featuredImageUrl = data.featuredImageUrl;
    if (data.contextId !== undefined) post.contextId = data.contextId;
    if (data.metaTitle !== undefined) post.metaTitle = data.metaTitle;
    if (data.metaDescription !== undefined) post.metaDescription = data.metaDescription;
    if (data.isDraft !== undefined) post.isDraft = data.isDraft;
    if (data.publishedAt !== undefined) post.publishedAt = data.publishedAt;
    post.updatedAt = new Date();

    return post;
  }

  async delete(id: string): Promise<boolean> {
    const idx = this.posts.findIndex((p) => p.id === id);
    if (idx === -1) return false;
    this.posts.splice(idx, 1);
    return true;
  }

  async getNavigation(currentPost: JournalPost): Promise<PostNavigation> {
    if (!currentPost.publishedAt) {
      return { prev: null, next: null };
    }

    const now = new Date();
    const published = this.posts
      .filter((p) => !p.isDraft && p.publishedAt && p.publishedAt <= now)
      .sort((a, b) => {
        const pubDiff = (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
        if (pubDiff !== 0) return pubDiff;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

    const currentIdx = published.findIndex((p) => p.id === currentPost.id);
    if (currentIdx === -1) return { prev: null, next: null };

    const prev = currentIdx < published.length - 1 ? published[currentIdx + 1] : null;
    const next = currentIdx > 0 ? published[currentIdx - 1] : null;

    return {
      prev: prev ? { slug: prev.slug, title: prev.title } : null,
      next: next ? { slug: next.slug, title: next.title } : null,
    };
  }

  async findAll(filters: {
    page: number;
    limit: number;
    status?: 'draft' | 'published';
  }): Promise<PaginatedPostsResult> {
    let filtered = [...this.posts];

    if (filters.status === 'draft') {
      filtered = filtered.filter((p) => p.isDraft);
    } else if (filters.status === 'published') {
      filtered = filtered.filter((p) => !p.isDraft);
    }

    filtered.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    const total = filtered.length;
    const offset = (filters.page - 1) * filters.limit;
    const posts = filtered.slice(offset, offset + filters.limit);

    return { posts, total };
  }

  // Helper to seed test data
  seed(posts: Partial<JournalPost>[]): void {
    for (const p of posts) {
      this.idCounter++;
      const post: JournalPost = {
        id: p.id ?? `post-${this.idCounter}`,
        slug: p.slug ?? `post-${this.idCounter}`,
        title: p.title ?? `Post ${this.idCounter}`,
        body: p.body ?? 'Test body content',
        bodyHtml: p.bodyHtml ?? '<p>Test body content</p>',
        excerpt: p.excerpt ?? 'Test excerpt',
        type: p.type ?? 'update',
        featuredImageUrl: p.featuredImageUrl ?? null,
        contextId: p.contextId ?? null,
        metaTitle: p.metaTitle ?? null,
        metaDescription: p.metaDescription ?? null,
        isDraft: p.isDraft ?? false,
        publishedAt: p.publishedAt ?? new Date(),
        createdAt: p.createdAt ?? new Date(),
        updatedAt: p.updatedAt ?? new Date(),
        authorId: p.authorId ?? 'author-1',
      };
      this.posts.push(post);
    }
  }

  clear(): void {
    this.posts = [];
    this.idCounter = 0;
  }
}

describe('Journal Public Endpoints e2e', () => {
  let app: INestApplication;
  let journalRepo: InMemoryJournalRepository;
  const journalBase = '/api/journal/posts';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, load: [authConfig], ignoreEnvFile: true }),
        AuthModule,
        UsersModule,
        JournalModule,
      ],
    })
      .overrideProvider(USERS_REPOSITORY)
      .useClass(InMemoryUsersRepository)
      .overrideProvider(REFRESH_TOKENS_REPOSITORY)
      .useClass(InMemoryRefreshTokensRepository)
      .overrideProvider(DATABASE_CONNECTION)
      .useValue({})
      .overrideProvider(JournalRepository)
      .useClass(InMemoryJournalRepository)
      .overrideProvider(JournalImageService)
      .useValue({
        uploadImage: async () => 'journal/test-image.jpg',
        getFilenameFromKey: (key: string) => key.split('/').pop() ?? key,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    journalRepo = app.get(JournalRepository) as unknown as InMemoryJournalRepository;

    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    journalRepo.clear();
  });

  describe('GET /journal/posts', () => {
    it('should return paginated results', async () => {
      // Seed 15 published posts
      const now = new Date();
      journalRepo.seed(
        Array.from({ length: 15 }, (_, i) => ({
          slug: `post-${i + 1}`,
          title: `Post ${i + 1}`,
          type: 'update' as PostType,
          isDraft: false,
          publishedAt: new Date(now.getTime() - i * 60000), // Each post 1 minute older
        })),
      );

      const res = await request(app.getHttpServer()).get(journalBase).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.posts).toHaveLength(10); // Default limit
      expect(res.body.data.meta.total).toBe(15);
      expect(res.body.data.meta.page).toBe(1);
      expect(res.body.data.meta.totalPages).toBe(2);

      // Verify sorted by publishedAt DESC (newest first)
      expect(res.body.data.posts[0].slug).toBe('post-1');
      expect(res.body.data.posts[9].slug).toBe('post-10');
    });

    it('should support pagination with page parameter', async () => {
      const now = new Date();
      journalRepo.seed(
        Array.from({ length: 15 }, (_, i) => ({
          slug: `post-${i + 1}`,
          title: `Post ${i + 1}`,
          type: 'update' as PostType,
          isDraft: false,
          publishedAt: new Date(now.getTime() - i * 60000),
        })),
      );

      const res = await request(app.getHttpServer()).get(`${journalBase}?page=2`).expect(200);

      expect(res.body.data.posts).toHaveLength(5); // Remaining posts
      expect(res.body.data.meta.page).toBe(2);
      expect(res.body.data.posts[0].slug).toBe('post-11');
    });

    it('should filter by single post type', async () => {
      journalRepo.seed([
        { slug: 'update-1', type: 'update' as PostType, isDraft: false, publishedAt: new Date() },
        { slug: 'fix-1', type: 'fix' as PostType, isDraft: false, publishedAt: new Date() },
        { slug: 'update-2', type: 'update' as PostType, isDraft: false, publishedAt: new Date() },
      ]);

      const res = await request(app.getHttpServer()).get(`${journalBase}?type=update`).expect(200);

      expect(res.body.data.posts).toHaveLength(2);
      expect(res.body.data.posts.every((p: any) => p.type === 'update')).toBe(true);
    });

    it('should filter by multiple post types (comma-separated)', async () => {
      journalRepo.seed([
        { slug: 'update-1', type: 'update' as PostType, isDraft: false, publishedAt: new Date() },
        { slug: 'fix-1', type: 'fix' as PostType, isDraft: false, publishedAt: new Date() },
        { slug: 'roadmap-1', type: 'roadmap' as PostType, isDraft: false, publishedAt: new Date() },
        {
          slug: 'explanation-1',
          type: 'explanation' as PostType,
          isDraft: false,
          publishedAt: new Date(),
        },
      ]);

      const res = await request(app.getHttpServer())
        .get(`${journalBase}?type=update,fix`)
        .expect(200);

      expect(res.body.data.posts).toHaveLength(2);
      expect(res.body.data.posts.every((p: any) => ['update', 'fix'].includes(p.type))).toBe(true);
    });

    it('should not return draft posts', async () => {
      journalRepo.seed([
        { slug: 'published-1', isDraft: false, publishedAt: new Date() },
        { slug: 'draft-1', isDraft: true, publishedAt: null },
        { slug: 'published-2', isDraft: false, publishedAt: new Date() },
      ]);

      const res = await request(app.getHttpServer()).get(journalBase).expect(200);

      expect(res.body.data.posts).toHaveLength(2);
      expect(res.body.data.posts.every((p: any) => !p.slug.startsWith('draft'))).toBe(true);
    });

    it('should not return scheduled posts with future publishedAt', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow

      journalRepo.seed([
        { slug: 'published-now', isDraft: false, publishedAt: now },
        { slug: 'scheduled-future', isDraft: false, publishedAt: future },
      ]);

      const res = await request(app.getHttpServer()).get(journalBase).expect(200);

      expect(res.body.data.posts).toHaveLength(1);
      expect(res.body.data.posts[0].slug).toBe('published-now');
    });

    it('should return empty list when no posts exist', async () => {
      const res = await request(app.getHttpServer()).get(journalBase).expect(200);

      expect(res.body.data.posts).toHaveLength(0);
      expect(res.body.data.meta.total).toBe(0);
    });

    it('should include Cache-Control header', async () => {
      const res = await request(app.getHttpServer()).get(journalBase).expect(200);

      expect(res.headers['cache-control']).toBe('public, max-age=60');
    });
  });

  describe('GET /journal/posts/:slug', () => {
    it('should return post with navigation', async () => {
      const now = new Date();
      journalRepo.seed([
        {
          slug: 'post-1',
          title: 'First Post',
          isDraft: false,
          publishedAt: new Date(now.getTime() - 2000),
        },
        {
          slug: 'post-2',
          title: 'Second Post',
          isDraft: false,
          publishedAt: new Date(now.getTime() - 1000),
        },
        { slug: 'post-3', title: 'Third Post', isDraft: false, publishedAt: now },
      ]);

      const res = await request(app.getHttpServer()).get(`${journalBase}/post-2`).expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.slug).toBe('post-2');
      expect(res.body.data.title).toBe('Second Post');
      expect(res.body.data.body).toBeDefined();
      expect(res.body.data.bodyHtml).toBeDefined();
      expect(res.body.data.navigation).toBeDefined();
      expect(res.body.data.navigation.prev).toEqual({ slug: 'post-1', title: 'First Post' });
      expect(res.body.data.navigation.next).toEqual({ slug: 'post-3', title: 'Third Post' });
    });

    it('should return 404 for non-existent slug', async () => {
      const res = await request(app.getHttpServer())
        .get(`${journalBase}/non-existent-slug`)
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });

    it('should return 404 for draft post slug', async () => {
      journalRepo.seed([{ slug: 'draft-post', isDraft: true, publishedAt: null }]);

      await request(app.getHttpServer()).get(`${journalBase}/draft-post`).expect(404);
    });

    it('should return 404 for scheduled post with future publishedAt', async () => {
      const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
      journalRepo.seed([{ slug: 'scheduled-post', isDraft: false, publishedAt: future }]);

      await request(app.getHttpServer()).get(`${journalBase}/scheduled-post`).expect(404);
    });

    it('should return null navigation when post is the only one', async () => {
      journalRepo.seed([{ slug: 'only-post', isDraft: false, publishedAt: new Date() }]);

      const res = await request(app.getHttpServer()).get(`${journalBase}/only-post`).expect(200);

      expect(res.body.data.navigation.prev).toBeNull();
      expect(res.body.data.navigation.next).toBeNull();
    });

    it('should return null prev for oldest post', async () => {
      const now = new Date();
      journalRepo.seed([
        {
          slug: 'oldest',
          title: 'Oldest',
          isDraft: false,
          publishedAt: new Date(now.getTime() - 1000),
        },
        { slug: 'newest', title: 'Newest', isDraft: false, publishedAt: now },
      ]);

      const res = await request(app.getHttpServer()).get(`${journalBase}/oldest`).expect(200);

      expect(res.body.data.navigation.prev).toBeNull();
      expect(res.body.data.navigation.next).toEqual({ slug: 'newest', title: 'Newest' });
    });

    it('should return null next for newest post', async () => {
      const now = new Date();
      journalRepo.seed([
        {
          slug: 'oldest',
          title: 'Oldest',
          isDraft: false,
          publishedAt: new Date(now.getTime() - 1000),
        },
        { slug: 'newest', title: 'Newest', isDraft: false, publishedAt: now },
      ]);

      const res = await request(app.getHttpServer()).get(`${journalBase}/newest`).expect(200);

      expect(res.body.data.navigation.prev).toEqual({ slug: 'oldest', title: 'Oldest' });
      expect(res.body.data.navigation.next).toBeNull();
    });

    it('should include Cache-Control header', async () => {
      journalRepo.seed([{ slug: 'test-post', isDraft: false, publishedAt: new Date() }]);

      const res = await request(app.getHttpServer()).get(`${journalBase}/test-post`).expect(200);

      expect(res.headers['cache-control']).toBe('public, max-age=300');
    });
  });
});
