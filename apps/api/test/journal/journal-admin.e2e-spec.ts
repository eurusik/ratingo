/**
 * Journal Admin Endpoints E2E Tests
 *
 * Tests for admin journal endpoints:
 * - CRUD operations
 * - Authentication requirements
 * - Publish/unpublish state transitions
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
import { User } from '../../src/modules/users/domain/entities/user.entity';
import { USERS_REPOSITORY } from '../../src/modules/users/domain/repositories/users.repository.interface';
import { UsersModule } from '../../src/modules/users/users.module';
import { InMemoryRefreshTokensRepository, InMemoryUsersRepository } from '../users/_fakes';

/**
 * In-memory journal repository for testing.
 */
class InMemoryJournalRepository {
  private posts: JournalPost[] = [];
  private idCounter = 0;

  private generateUUID(): string {
    this.idCounter++;
    // Generate a valid UUID format for testing
    const hex = this.idCounter.toString(16).padStart(12, '0');
    return `00000000-0000-0000-0000-${hex}`;
  }

  async findPublished(filters: FindPublishedFilters): Promise<PaginatedPostsResult> {
    const now = new Date();
    let filtered = this.posts.filter((p) => !p.isDraft && p.publishedAt && p.publishedAt <= now);

    if (filters.types?.length) {
      filtered = filtered.filter((p) => filters.types!.includes(p.type));
    }

    if (filters.contextId) {
      filtered = filtered.filter((p) => p.contextId === filters.contextId);
    }

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
    const post: JournalPost = {
      id: this.generateUUID(),
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

  seed(posts: Partial<JournalPost>[]): void {
    for (const p of posts) {
      const id = p.id ?? this.generateUUID();
      const post: JournalPost = {
        id,
        slug: p.slug ?? `post-${id}`,
        title: p.title ?? `Post ${id}`,
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

describe('Journal Admin Endpoints e2e', () => {
  let app: INestApplication;
  let journalRepo: InMemoryJournalRepository;
  let usersRepo: InMemoryUsersRepository;
  let jwtService: JwtService;
  let configService: ConfigService;
  const adminBase = '/api/admin/journal/posts';
  const authBase = '/api/auth';

  let adminToken: string;
  let userToken: string;
  let adminUserId: string;

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
    usersRepo = app.get(USERS_REPOSITORY) as unknown as InMemoryUsersRepository;
    jwtService = app.get(JwtService);
    configService = app.get(ConfigService);

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

  beforeEach(async () => {
    journalRepo.clear();

    // Create admin user
    const adminEmail = `admin${Date.now()}@example.com`;
    const adminUsername = `admin${Date.now()}`;
    await request(app.getHttpServer())
      .post(`${authBase}/register`)
      .send({ email: adminEmail, username: adminUsername, password: 'S3curePassw0rd' })
      .expect(201);

    // Get admin user and update role
    const adminUser = await usersRepo.findByEmail(adminEmail);
    if (adminUser) {
      (adminUser as any).role = 'admin';
      adminUserId = adminUser.id;
    }

    // Generate admin token
    const secret = configService.get<string>('auth.accessTokenSecret');
    adminToken = await jwtService.signAsync(
      { sub: adminUserId, email: adminEmail, role: 'admin' },
      { secret, expiresIn: '15m' },
    );

    // Create regular user
    const userEmail = `user${Date.now()}@example.com`;
    const userUsername = `user${Date.now()}`;
    const userRes = await request(app.getHttpServer())
      .post(`${authBase}/register`)
      .send({ email: userEmail, username: userUsername, password: 'S3curePassw0rd' })
      .expect(201);

    userToken = userRes.body.data.accessToken;
  });

  describe('Authentication', () => {
    it('should return 401 for unauthenticated GET /admin/journal/posts', async () => {
      await request(app.getHttpServer()).get(adminBase).expect(401);
    });

    it('should return 401 for unauthenticated POST /admin/journal/posts', async () => {
      await request(app.getHttpServer())
        .post(adminBase)
        .send({ title: 'Test', body: 'Test content', type: 'update' })
        .expect(401);
    });

    it('should return 401 for unauthenticated GET /admin/journal/posts/:id', async () => {
      await request(app.getHttpServer()).get(`${adminBase}/some-id`).expect(401);
    });

    it('should return 401 for unauthenticated PATCH /admin/journal/posts/:id', async () => {
      await request(app.getHttpServer())
        .patch(`${adminBase}/some-id`)
        .send({ title: 'Updated' })
        .expect(401);
    });

    it('should return 401 for unauthenticated DELETE /admin/journal/posts/:id', async () => {
      await request(app.getHttpServer()).delete(`${adminBase}/some-id`).expect(401);
    });

    it('should return 403 for non-admin user on GET /admin/journal/posts', async () => {
      await request(app.getHttpServer())
        .get(adminBase)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 403 for non-admin user on POST /admin/journal/posts', async () => {
      await request(app.getHttpServer())
        .post(adminBase)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ title: 'Test Post', body: 'Test content here', type: 'update' })
        .expect(403);
    });
  });

  describe('CRUD Operations', () => {
    describe('POST /admin/journal/posts - Create', () => {
      it('should create a draft post', async () => {
        const res = await request(app.getHttpServer())
          .post(adminBase)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'New Post Title',
            body: 'This is the post body content.',
            type: 'update',
          })
          .expect(201);

        expect(res.body.success).toBe(true);
        expect(res.body.data.title).toBe('New Post Title');
        expect(res.body.data.type).toBe('update');
        expect(res.body.data.isDraft).toBe(true);
        expect(res.body.data.slug).toBeDefined();
        expect(res.body.data.authorId).toBe(adminUserId);
      });

      it('should create a published post with publishedAt', async () => {
        const now = new Date().toISOString();
        const res = await request(app.getHttpServer())
          .post(adminBase)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Published Post',
            body: 'This is published content.',
            type: 'fix',
            isDraft: false,
            publishedAt: now,
          })
          .expect(201);

        expect(res.body.data.isDraft).toBe(false);
        expect(res.body.data.publishedAt).toBeDefined();
      });

      it('should auto-generate slug from title', async () => {
        const res = await request(app.getHttpServer())
          .post(adminBase)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'My Amazing Post Title',
            body: 'Content here for the post.',
            type: 'update',
          })
          .expect(201);

        expect(res.body.data.slug).toMatch(/my-amazing-post-title/);
      });

      it('should use custom slug when provided', async () => {
        const res = await request(app.getHttpServer())
          .post(adminBase)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Post With Custom Slug',
            body: 'Content for custom slug post.',
            type: 'update',
            slug: 'custom-slug-here',
          })
          .expect(201);

        expect(res.body.data.slug).toBe('custom-slug-here');
      });

      it('should validate required fields', async () => {
        await request(app.getHttpServer())
          .post(adminBase)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({})
          .expect(400);
      });

      it('should validate post type', async () => {
        await request(app.getHttpServer())
          .post(adminBase)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            title: 'Invalid Type Post',
            body: 'Content here.',
            type: 'invalid-type',
          })
          .expect(400);
      });
    });

    describe('GET /admin/journal/posts - List', () => {
      it('should return all posts including drafts', async () => {
        journalRepo.seed([
          { slug: 'published-1', isDraft: false, publishedAt: new Date(), authorId: adminUserId },
          { slug: 'draft-1', isDraft: true, publishedAt: null, authorId: adminUserId },
        ]);

        const res = await request(app.getHttpServer())
          .get(adminBase)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.data.posts).toHaveLength(2);
      });

      it('should filter by draft status', async () => {
        journalRepo.seed([
          { slug: 'published-1', isDraft: false, publishedAt: new Date(), authorId: adminUserId },
          { slug: 'draft-1', isDraft: true, publishedAt: null, authorId: adminUserId },
        ]);

        const res = await request(app.getHttpServer())
          .get(`${adminBase}?status=draft`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.data.posts).toHaveLength(1);
        expect(res.body.data.posts[0].isDraft).toBe(true);
      });
    });

    describe('GET /admin/journal/posts/:id - Get by ID', () => {
      const testPostId = '00000000-0000-0000-0000-000000000001';
      const draftPostId = '00000000-0000-0000-0000-000000000002';

      it('should return post by ID', async () => {
        journalRepo.seed([
          { id: testPostId, slug: 'test-post', title: 'Test Post', authorId: adminUserId },
        ]);

        const res = await request(app.getHttpServer())
          .get(`${adminBase}/${testPostId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.data.id).toBe(testPostId);
        expect(res.body.data.title).toBe('Test Post');
      });

      it('should return 404 for non-existent ID', async () => {
        await request(app.getHttpServer())
          .get(`${adminBase}/00000000-0000-0000-0000-000000000099`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });

      it('should return draft posts by ID', async () => {
        journalRepo.seed([
          {
            id: draftPostId,
            slug: 'draft-post',
            isDraft: true,
            publishedAt: null,
            authorId: adminUserId,
          },
        ]);

        const res = await request(app.getHttpServer())
          .get(`${adminBase}/${draftPostId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.data.isDraft).toBe(true);
      });
    });

    describe('PATCH /admin/journal/posts/:id - Update', () => {
      const updatePostId = '00000000-0000-0000-0000-000000000003';
      const typePostId = '00000000-0000-0000-0000-000000000004';

      it('should update post title', async () => {
        journalRepo.seed([
          { id: updatePostId, slug: 'update-post', title: 'Original Title', authorId: adminUserId },
        ]);

        const res = await request(app.getHttpServer())
          .patch(`${adminBase}/${updatePostId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated Title' })
          .expect(200);

        expect(res.body.data.title).toBe('Updated Title');
      });

      it('should update post type', async () => {
        journalRepo.seed([
          { id: typePostId, slug: 'type-post', type: 'update' as PostType, authorId: adminUserId },
        ]);

        const res = await request(app.getHttpServer())
          .patch(`${adminBase}/${typePostId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ type: 'fix' })
          .expect(200);

        expect(res.body.data.type).toBe('fix');
      });

      it('should return 404 for non-existent ID', async () => {
        await request(app.getHttpServer())
          .patch(`${adminBase}/00000000-0000-0000-0000-000000000099`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ title: 'Updated' })
          .expect(404);
      });
    });

    describe('DELETE /admin/journal/posts/:id - Delete', () => {
      const deletePostId = '00000000-0000-0000-0000-000000000005';

      it('should delete post', async () => {
        journalRepo.seed([{ id: deletePostId, slug: 'delete-post', authorId: adminUserId }]);

        const res = await request(app.getHttpServer())
          .delete(`${adminBase}/${deletePostId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.data.success).toBe(true);

        // Verify deleted
        await request(app.getHttpServer())
          .get(`${adminBase}/${deletePostId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });

      it('should return 404 for non-existent ID', async () => {
        await request(app.getHttpServer())
          .delete(`${adminBase}/00000000-0000-0000-0000-000000000099`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });
    });
  });

  describe('Publish/Unpublish State Transitions', () => {
    const draftToPublishId = '00000000-0000-0000-0000-000000000006';
    const alreadyPublishedId = '00000000-0000-0000-0000-000000000007';
    const publishedToDraftId = '00000000-0000-0000-0000-000000000008';
    const alreadyDraftId = '00000000-0000-0000-0000-000000000009';

    describe('POST /admin/journal/posts/:id/publish', () => {
      it('should publish a draft post', async () => {
        journalRepo.seed([
          {
            id: draftToPublishId,
            slug: 'draft-post',
            isDraft: true,
            publishedAt: null,
            authorId: adminUserId,
          },
        ]);

        const res = await request(app.getHttpServer())
          .post(`${adminBase}/${draftToPublishId}/publish`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.data.isDraft).toBe(false);
        expect(res.body.data.publishedAt).toBeDefined();
      });

      it('should return 400 when publishing already published post', async () => {
        journalRepo.seed([
          {
            id: alreadyPublishedId,
            slug: 'published-post',
            isDraft: false,
            publishedAt: new Date(),
            authorId: adminUserId,
          },
        ]);

        await request(app.getHttpServer())
          .post(`${adminBase}/${alreadyPublishedId}/publish`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });

      it('should return 404 for non-existent post', async () => {
        await request(app.getHttpServer())
          .post(`${adminBase}/00000000-0000-0000-0000-000000000099/publish`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });
    });

    describe('POST /admin/journal/posts/:id/unpublish', () => {
      it('should unpublish a published post', async () => {
        journalRepo.seed([
          {
            id: publishedToDraftId,
            slug: 'published-post',
            isDraft: false,
            publishedAt: new Date(),
            authorId: adminUserId,
          },
        ]);

        const res = await request(app.getHttpServer())
          .post(`${adminBase}/${publishedToDraftId}/unpublish`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(res.body.data.isDraft).toBe(true);
        expect(res.body.data.publishedAt).toBeNull();
      });

      it('should return 400 when unpublishing already draft post', async () => {
        journalRepo.seed([
          {
            id: alreadyDraftId,
            slug: 'draft-post',
            isDraft: true,
            publishedAt: null,
            authorId: adminUserId,
          },
        ]);

        await request(app.getHttpServer())
          .post(`${adminBase}/${alreadyDraftId}/unpublish`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(400);
      });

      it('should return 404 for non-existent post', async () => {
        await request(app.getHttpServer())
          .post(`${adminBase}/00000000-0000-0000-0000-000000000099/unpublish`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(404);
      });
    });
  });

  describe('Full CRUD Flow', () => {
    it('should complete create -> read -> update -> publish -> unpublish -> delete flow', async () => {
      // Create
      const createRes = await request(app.getHttpServer())
        .post(adminBase)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'CRUD Flow Test Post',
          body: 'This is a test post for CRUD flow.',
          type: 'update',
        })
        .expect(201);

      const postId = createRes.body.data.id;
      expect(postId).toBeDefined();
      expect(createRes.body.data.isDraft).toBe(true);

      // Read
      const readRes = await request(app.getHttpServer())
        .get(`${adminBase}/${postId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(readRes.body.data.title).toBe('CRUD Flow Test Post');

      // Update
      const updateRes = await request(app.getHttpServer())
        .patch(`${adminBase}/${postId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Updated CRUD Flow Test Post' })
        .expect(200);

      expect(updateRes.body.data.title).toBe('Updated CRUD Flow Test Post');

      // Publish
      const publishRes = await request(app.getHttpServer())
        .post(`${adminBase}/${postId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(publishRes.body.data.isDraft).toBe(false);

      // Unpublish
      const unpublishRes = await request(app.getHttpServer())
        .post(`${adminBase}/${postId}/unpublish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(unpublishRes.body.data.isDraft).toBe(true);

      // Delete
      await request(app.getHttpServer())
        .delete(`${adminBase}/${postId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      // Verify deleted
      await request(app.getHttpServer())
        .get(`${adminBase}/${postId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
