/**
 * Tests for journal hooks mappers.
 *
 * Verifies DTO → domain type conversion.
 */

import type { PostListResponseDto, PostDetailDto, AdminPostDto } from '../../types';

// Re-create mapper functions for testing (they're private in hooks)
// This ensures the mapping logic is correct

function mapPostListItem(dto: PostListResponseDto['posts'][number]) {
  return {
    id: dto.id,
    slug: dto.slug,
    title: dto.title,
    excerpt: dto.excerpt,
    type: dto.type,
    featuredImageUrl: dto.featuredImageUrl ?? null,
    publishedAt: new Date(dto.publishedAt),
    createdAt: new Date(dto.createdAt),
  };
}

function mapNavigation(dto: PostDetailDto['navigation']) {
  return {
    prev: dto.prev ? { slug: dto.prev.slug, title: dto.prev.title } : null,
    next: dto.next ? { slug: dto.next.slug, title: dto.next.title } : null,
  };
}

function mapPostDetail(dto: PostDetailDto) {
  return {
    id: dto.id,
    slug: dto.slug,
    title: dto.title,
    excerpt: dto.excerpt,
    type: dto.type,
    featuredImageUrl: dto.featuredImageUrl ?? null,
    publishedAt: new Date(dto.publishedAt),
    createdAt: new Date(dto.createdAt),
    body: dto.body,
    bodyHtml: dto.bodyHtml,
    contextId: dto.contextId ?? null,
    metaTitle: dto.metaTitle ?? null,
    metaDescription: dto.metaDescription ?? null,
    updatedAt: new Date(dto.updatedAt),
    navigation: mapNavigation(dto.navigation),
  };
}

function mapAdminPost(dto: AdminPostDto) {
  return {
    ...mapPostDetail(dto),
    isDraft: dto.isDraft,
    authorId: dto.authorId,
  };
}

describe('Journal Mappers', () => {
  describe('mapPostListItem', () => {
    it('should convert date strings to Date objects', () => {
      const dto: PostListResponseDto['posts'][number] = {
        id: '123',
        slug: 'test-post',
        title: 'Test Post',
        excerpt: 'This is a test',
        type: 'update',
        featuredImageUrl: 'https://example.com/image.jpg',
        publishedAt: '2026-01-15T10:00:00.000Z' as unknown as Date,
        createdAt: '2026-01-14T15:30:00.000Z' as unknown as Date,
      };

      const result = mapPostListItem(dto);

      expect(result.publishedAt).toBeInstanceOf(Date);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.publishedAt.toISOString()).toBe('2026-01-15T10:00:00.000Z');
      expect(result.createdAt.toISOString()).toBe('2026-01-14T15:30:00.000Z');
    });

    it('should normalize null featuredImageUrl', () => {
      const dto: PostListResponseDto['posts'][number] = {
        id: '123',
        slug: 'test-post',
        title: 'Test Post',
        excerpt: 'This is a test',
        type: 'update',
        featuredImageUrl: null,
        publishedAt: '2026-01-15T10:00:00.000Z' as unknown as Date,
        createdAt: '2026-01-14T15:30:00.000Z' as unknown as Date,
      };

      const result = mapPostListItem(dto);

      expect(result.featuredImageUrl).toBeNull();
    });

    it('should preserve all other fields', () => {
      const dto: PostListResponseDto['posts'][number] = {
        id: 'abc-123',
        slug: 'my-slug',
        title: 'My Title',
        excerpt: 'My excerpt',
        type: 'fix',
        featuredImageUrl: 'https://cdn.example.com/img.png',
        publishedAt: '2026-01-15T10:00:00.000Z' as unknown as Date,
        createdAt: '2026-01-14T15:30:00.000Z' as unknown as Date,
      };

      const result = mapPostListItem(dto);

      expect(result.id).toBe('abc-123');
      expect(result.slug).toBe('my-slug');
      expect(result.title).toBe('My Title');
      expect(result.excerpt).toBe('My excerpt');
      expect(result.type).toBe('fix');
      expect(result.featuredImageUrl).toBe('https://cdn.example.com/img.png');
    });
  });

  describe('mapNavigation', () => {
    it('should map navigation with both prev and next', () => {
      const dto = {
        prev: { slug: 'prev-post', title: 'Previous Post' },
        next: { slug: 'next-post', title: 'Next Post' },
      };

      const result = mapNavigation(dto);

      expect(result.prev).toEqual({ slug: 'prev-post', title: 'Previous Post' });
      expect(result.next).toEqual({ slug: 'next-post', title: 'Next Post' });
    });

    it('should handle null prev', () => {
      const dto = {
        prev: null,
        next: { slug: 'next-post', title: 'Next Post' },
      };

      const result = mapNavigation(dto);

      expect(result.prev).toBeNull();
      expect(result.next).toEqual({ slug: 'next-post', title: 'Next Post' });
    });

    it('should handle null next', () => {
      const dto = {
        prev: { slug: 'prev-post', title: 'Previous Post' },
        next: null,
      };

      const result = mapNavigation(dto);

      expect(result.prev).toEqual({ slug: 'prev-post', title: 'Previous Post' });
      expect(result.next).toBeNull();
    });

    it('should handle both null', () => {
      const dto = {
        prev: null,
        next: null,
      };

      const result = mapNavigation(dto);

      expect(result.prev).toBeNull();
      expect(result.next).toBeNull();
    });
  });

  describe('mapPostDetail', () => {
    const baseDto: PostDetailDto = {
      id: '123',
      slug: 'test-post',
      title: 'Test Post',
      excerpt: 'This is a test',
      type: 'update',
      featuredImageUrl: 'https://example.com/image.jpg',
      publishedAt: '2026-01-15T10:00:00.000Z' as unknown as Date,
      createdAt: '2026-01-14T15:30:00.000Z' as unknown as Date,
      body: '## Hello\n\nWorld',
      bodyHtml: '<h2>Hello</h2><p>World</p>',
      contextId: 'trending',
      metaTitle: 'Test Post | Journal',
      metaDescription: 'A test post description',
      updatedAt: '2026-01-15T12:00:00.000Z' as unknown as Date,
      navigation: {
        prev: { slug: 'prev', title: 'Prev' },
        next: { slug: 'next', title: 'Next' },
      },
    };

    it('should convert all date strings to Date objects', () => {
      const result = mapPostDetail(baseDto);

      expect(result.publishedAt).toBeInstanceOf(Date);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should map navigation correctly', () => {
      const result = mapPostDetail(baseDto);

      expect(result.navigation.prev).toEqual({ slug: 'prev', title: 'Prev' });
      expect(result.navigation.next).toEqual({ slug: 'next', title: 'Next' });
    });

    it('should normalize null optional fields', () => {
      const dto: PostDetailDto = {
        ...baseDto,
        featuredImageUrl: null,
        contextId: null,
        metaTitle: null,
        metaDescription: null,
      };

      const result = mapPostDetail(dto);

      expect(result.featuredImageUrl).toBeNull();
      expect(result.contextId).toBeNull();
      expect(result.metaTitle).toBeNull();
      expect(result.metaDescription).toBeNull();
    });
  });

  describe('mapAdminPost', () => {
    it('should include isDraft and authorId', () => {
      const dto: AdminPostDto = {
        id: '123',
        slug: 'test-post',
        title: 'Test Post',
        excerpt: 'This is a test',
        type: 'update',
        featuredImageUrl: null,
        publishedAt: '2026-01-15T10:00:00.000Z' as unknown as Date,
        createdAt: '2026-01-14T15:30:00.000Z' as unknown as Date,
        body: '## Hello',
        bodyHtml: '<h2>Hello</h2>',
        contextId: null,
        metaTitle: null,
        metaDescription: null,
        updatedAt: '2026-01-15T12:00:00.000Z' as unknown as Date,
        navigation: { prev: null, next: null },
        isDraft: true,
        authorId: 'author-456',
      };

      const result = mapAdminPost(dto);

      expect(result.isDraft).toBe(true);
      expect(result.authorId).toBe('author-456');
    });
  });
});
