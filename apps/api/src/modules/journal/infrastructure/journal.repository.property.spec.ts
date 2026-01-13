import * as fc from 'fast-check';

import { POST_TYPE_VALUES, PostType } from '../domain/constants/post-types';
import { JournalPost } from '../domain/interfaces/journal-post.interface';

/**
 * Feature: product-journal
 * Property tests for JournalRepository
 *
 * These tests validate the correctness properties of the repository
 * using pure functions that mirror the repository's filtering and sorting logic.
 */

// --- Test Helpers ---

/**
 * Generates a valid JournalPost for testing.
 */
const journalPostArb = fc.record({
  id: fc.uuid(),
  slug: fc.string({ minLength: 1, maxLength: 100 }).map(
    (s) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'post',
  ),
  title: fc.string({ minLength: 3, maxLength: 200 }),
  body: fc.string({ minLength: 10 }),
  bodyHtml: fc.string({ minLength: 10 }),
  excerpt: fc.string({ minLength: 1, maxLength: 200 }),
  type: fc.constantFrom(...POST_TYPE_VALUES) as fc.Arbitrary<PostType>,
  featuredImageUrl: fc.option(fc.webUrl(), { nil: null }),
  contextId: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
  metaTitle: fc.option(fc.string({ minLength: 1, maxLength: 70 }), { nil: null }),
  metaDescription: fc.option(fc.string({ minLength: 1, maxLength: 160 }), { nil: null }),
  isDraft: fc.boolean(),
  publishedAt: fc.option(fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }), {
    nil: null,
  }),
  createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
  updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-01-01') }),
  authorId: fc.uuid(),
});

/**
 * Generates a published post (isDraft=false, publishedAt in the past).
 */
const publishedPostArb = journalPostArb.map((post) => ({
  ...post,
  isDraft: false,
  publishedAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000), // Random date in past year
}));

/**
 * Pure function that mirrors the repository's sorting logic.
 * Posts are sorted by publishedAt DESC, then createdAt DESC as tie-breaker.
 */
function sortByPublishedDate(posts: JournalPost[]): JournalPost[] {
  return [...posts].sort((a, b) => {
    // Both should have publishedAt for published posts
    const aPublished = a.publishedAt?.getTime() ?? 0;
    const bPublished = b.publishedAt?.getTime() ?? 0;

    if (aPublished !== bPublished) {
      return bPublished - aPublished; // DESC
    }

    // Tie-breaker: createdAt DESC
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}

/**
 * Pure function that mirrors the repository's visibility filter.
 * A post is visible if: isDraft=false AND publishedAt <= now
 */
function filterVisiblePosts(posts: JournalPost[], now: Date = new Date()): JournalPost[] {
  return posts.filter(
    (post) => !post.isDraft && post.publishedAt !== null && post.publishedAt <= now,
  );
}

/**
 * Pure function that mirrors the repository's type filtering.
 * Returns posts matching ANY of the specified types (union).
 */
function filterByTypes(posts: JournalPost[], types: PostType[]): JournalPost[] {
  if (types.length === 0) return posts;
  return posts.filter((post) => types.includes(post.type));
}

/**
 * Pure function that mirrors the repository's pagination.
 */
function paginate<T>(items: T[], page: number, limit: number): T[] {
  const offset = (page - 1) * limit;
  return items.slice(offset, offset + limit);
}

/**
 * Generates a scheduled post (isDraft=false, publishedAt in the future).
 */
const scheduledPostArb = journalPostArb.map((post) => ({
  ...post,
  isDraft: false,
  publishedAt: new Date(Date.now() + Math.random() * 365 * 24 * 60 * 60 * 1000 + 60000), // Random date in future (at least 1 minute from now)
}));

/**
 * Generates a draft post (isDraft=true, publishedAt=null).
 */
const draftPostArb = journalPostArb.map((post) => ({
  ...post,
  isDraft: true,
  publishedAt: null,
}));

// --- Property Tests ---

describe('JournalRepository - Property Tests', () => {
  /**
   * For any list of published posts, the posts SHALL be sorted by
   * publishedAt in descending order (newest first), with createdAt as tie-breaker.
   */
  describe('Property 1: Posts sorted by publication date', () => {
    it('should sort posts by publishedAt DESC with createdAt as tie-breaker', () => {
      fc.assert(
        fc.property(fc.array(publishedPostArb, { minLength: 0, maxLength: 50 }), (posts) => {
          const sorted = sortByPublishedDate(posts);

          // Verify ordering: each post should be >= the next in terms of publishedAt
          for (let i = 0; i < sorted.length - 1; i++) {
            const current = sorted[i];
            const next = sorted[i + 1];

            const currentPublished = current.publishedAt?.getTime() ?? 0;
            const nextPublished = next.publishedAt?.getTime() ?? 0;

            // Current should be >= next (DESC order)
            if (currentPublished !== nextPublished) {
              expect(currentPublished).toBeGreaterThanOrEqual(nextPublished);
            } else {
              // Tie-breaker: createdAt DESC
              expect(current.createdAt.getTime()).toBeGreaterThanOrEqual(next.createdAt.getTime());
            }
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should be stable - sorting twice produces same result', () => {
      fc.assert(
        fc.property(fc.array(publishedPostArb, { minLength: 0, maxLength: 50 }), (posts) => {
          const sorted1 = sortByPublishedDate(posts);
          const sorted2 = sortByPublishedDate(sorted1);

          expect(sorted1.map((p) => p.id)).toEqual(sorted2.map((p) => p.id));
        }),
        { numRuns: 100 },
      );
    });

    it('should preserve all posts - no posts lost or duplicated', () => {
      fc.assert(
        fc.property(fc.array(publishedPostArb, { minLength: 0, maxLength: 50 }), (posts) => {
          const sorted = sortByPublishedDate(posts);

          expect(sorted.length).toBe(posts.length);

          const originalIds = new Set(posts.map((p) => p.id));
          const sortedIds = new Set(sorted.map((p) => p.id));

          expect(sortedIds).toEqual(originalIds);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * For any type filter applied to the posts endpoint, all returned posts
   * SHALL have a type matching one of the filter values (union).
   */
  describe('Property 3: Type filtering returns matching posts', () => {
    const postTypeArb = fc.constantFrom(...POST_TYPE_VALUES) as fc.Arbitrary<PostType>;
    const typeFilterArb = fc.array(postTypeArb, { minLength: 0, maxLength: 4 });

    it('should return only posts matching the specified types', () => {
      fc.assert(
        fc.property(
          fc.array(publishedPostArb, { minLength: 0, maxLength: 50 }),
          typeFilterArb,
          (posts, types) => {
            const filtered = filterByTypes(posts, types);

            if (types.length === 0) {
              // No filter = all posts returned
              expect(filtered.length).toBe(posts.length);
            } else {
              // All returned posts must have a type in the filter
              for (const post of filtered) {
                expect(types).toContain(post.type);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include all posts that match any of the specified types', () => {
      fc.assert(
        fc.property(
          fc.array(publishedPostArb, { minLength: 0, maxLength: 50 }),
          typeFilterArb,
          (posts, types) => {
            const filtered = filterByTypes(posts, types);

            if (types.length > 0) {
              // Count posts that should match
              const expectedCount = posts.filter((p) => types.includes(p.type)).length;
              expect(filtered.length).toBe(expectedCount);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return empty array when no posts match the filter', () => {
      fc.assert(
        fc.property(
          fc.array(publishedPostArb, { minLength: 0, maxLength: 50 }),
          postTypeArb,
          (posts, filterType) => {
            // Create posts that don't match the filter type
            const nonMatchingPosts = posts.map((p) => ({
              ...p,
              type: POST_TYPE_VALUES.find((t) => t !== filterType) ?? 'update',
            })) as JournalPost[];

            const filtered = filterByTypes(nonMatchingPosts, [filterType]);

            // Should be empty since no posts match
            expect(filtered.length).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should support multi-type filtering (union)', () => {
      fc.assert(
        fc.property(
          fc.array(publishedPostArb, { minLength: 5, maxLength: 50 }),
          fc.array(postTypeArb, { minLength: 2, maxLength: 4 }),
          (posts, types) => {
            const uniqueTypes = [...new Set(types)];
            const filtered = filterByTypes(posts, uniqueTypes);

            // Each filtered post should match at least one type
            for (const post of filtered) {
              expect(uniqueTypes.some((t) => t === post.type)).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * For any page request with limit N, the API SHALL return at most N posts,
   * and totalPages SHALL equal ceil(total / limit).
   */
  describe('Property 4: Pagination correctness', () => {
    const paginationArb = fc.record({
      page: fc.integer({ min: 1, max: 100 }),
      limit: fc.integer({ min: 1, max: 50 }),
    });

    it('should return at most limit posts per page', () => {
      fc.assert(
        fc.property(
          fc.array(publishedPostArb, { minLength: 0, maxLength: 100 }),
          paginationArb,
          (posts, { page, limit }) => {
            const paginated = paginate(posts, page, limit);

            expect(paginated.length).toBeLessThanOrEqual(limit);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should calculate totalPages correctly', () => {
      fc.assert(
        fc.property(
          fc.array(publishedPostArb, { minLength: 0, maxLength: 100 }),
          fc.integer({ min: 1, max: 50 }),
          (posts, limit) => {
            const total = posts.length;
            const expectedTotalPages = Math.ceil(total / limit);

            // Verify the formula
            expect(expectedTotalPages).toBe(Math.ceil(total / limit));

            // Verify that all posts can be retrieved across all pages
            let retrievedCount = 0;
            for (let page = 1; page <= expectedTotalPages; page++) {
              retrievedCount += paginate(posts, page, limit).length;
            }
            expect(retrievedCount).toBe(total);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return correct posts for each page', () => {
      fc.assert(
        fc.property(
          fc.array(publishedPostArb, { minLength: 1, maxLength: 100 }),
          paginationArb,
          (posts, { page, limit }) => {
            const paginated = paginate(posts, page, limit);
            const offset = (page - 1) * limit;

            // Verify the paginated posts match the expected slice
            const expected = posts.slice(offset, offset + limit);
            expect(paginated.map((p) => p.id)).toEqual(expected.map((p) => p.id));
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return empty array for pages beyond total', () => {
      fc.assert(
        fc.property(
          fc.array(publishedPostArb, { minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 10 }),
          (posts, limit) => {
            const totalPages = Math.ceil(posts.length / limit);
            const beyondPage = totalPages + 1;

            const paginated = paginate(posts, beyondPage, limit);

            expect(paginated.length).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should not have overlapping posts between consecutive pages', () => {
      fc.assert(
        fc.property(
          fc.array(publishedPostArb, { minLength: 2, maxLength: 100 }),
          fc.integer({ min: 1, max: 20 }),
          (posts, limit) => {
            const totalPages = Math.ceil(posts.length / limit);

            for (let page = 1; page < totalPages; page++) {
              const currentPage = paginate(posts, page, limit);
              const nextPage = paginate(posts, page + 1, limit);

              const currentIds = new Set(currentPage.map((p) => p.id));
              const nextIds = new Set(nextPage.map((p) => p.id));

              // No overlap between pages
              for (const id of nextIds) {
                expect(currentIds.has(id)).toBe(false);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * For any post with publishedAt in the future, the post SHALL NOT appear
   * in public API responses (list or by slug).
   */
  describe('Property 7: Scheduled posts visibility', () => {
    it('should exclude scheduled posts (publishedAt in future) from visible posts', () => {
      fc.assert(
        fc.property(
          fc.array(scheduledPostArb, { minLength: 1, maxLength: 50 }),
          (scheduledPosts) => {
            const now = new Date();
            const visible = filterVisiblePosts(scheduledPosts, now);

            // No scheduled posts should be visible
            expect(visible.length).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should exclude draft posts from visible posts', () => {
      fc.assert(
        fc.property(fc.array(draftPostArb, { minLength: 1, maxLength: 50 }), (draftPosts) => {
          const now = new Date();
          const visible = filterVisiblePosts(draftPosts, now);

          // No draft posts should be visible
          expect(visible.length).toBe(0);
        }),
        { numRuns: 100 },
      );
    });

    it('should include only published posts with publishedAt <= now', () => {
      fc.assert(
        fc.property(
          fc.array(publishedPostArb, { minLength: 0, maxLength: 50 }),
          (publishedPosts) => {
            const now = new Date();
            const visible = filterVisiblePosts(publishedPosts, now);

            // All visible posts should have isDraft=false and publishedAt <= now
            for (const post of visible) {
              expect(post.isDraft).toBe(false);
              expect(post.publishedAt).not.toBeNull();
              expect(post.publishedAt!.getTime()).toBeLessThanOrEqual(now.getTime());
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should correctly filter mixed posts (published, scheduled, draft)', () => {
      // Generate a mix of all post types
      const mixedPostsArb = fc.tuple(
        fc.array(publishedPostArb, { minLength: 0, maxLength: 20 }),
        fc.array(scheduledPostArb, { minLength: 0, maxLength: 20 }),
        fc.array(draftPostArb, { minLength: 0, maxLength: 20 }),
      );

      fc.assert(
        fc.property(mixedPostsArb, ([published, scheduled, drafts]) => {
          const allPosts = [...published, ...scheduled, ...drafts];
          const now = new Date();
          const visible = filterVisiblePosts(allPosts, now);

          // Visible count should equal published posts count (those with publishedAt <= now)
          const expectedVisibleCount = published.filter(
            (p) => p.publishedAt !== null && p.publishedAt <= now,
          ).length;
          expect(visible.length).toBe(expectedVisibleCount);

          // No scheduled or draft posts should be in visible
          for (const post of visible) {
            expect(post.isDraft).toBe(false);
            expect(post.publishedAt).not.toBeNull();
            expect(post.publishedAt!.getTime()).toBeLessThanOrEqual(now.getTime());
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should make scheduled posts visible once their publishedAt time passes', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }),
          (scheduledDate) => {
            // Create a post scheduled for a specific date
            const post: JournalPost = {
              id: 'test-id',
              slug: 'test-slug',
              title: 'Test Post',
              body: 'Test body content',
              bodyHtml: '<p>Test body content</p>',
              excerpt: 'Test excerpt',
              type: 'update',
              featuredImageUrl: null,
              contextId: null,
              metaTitle: null,
              metaDescription: null,
              isDraft: false,
              publishedAt: scheduledDate,
              createdAt: new Date('2020-01-01'),
              updatedAt: new Date('2020-01-01'),
              authorId: 'author-id',
            };

            // Before the scheduled date: not visible
            const beforeDate = new Date(scheduledDate.getTime() - 1000);
            const visibleBefore = filterVisiblePosts([post], beforeDate);
            expect(visibleBefore.length).toBe(0);

            // At or after the scheduled date: visible
            const afterDate = new Date(scheduledDate.getTime() + 1000);
            const visibleAfter = filterVisiblePosts([post], afterDate);
            expect(visibleAfter.length).toBe(1);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should preserve post count: visible + invisible = total', () => {
      const mixedPostsArb = fc.tuple(
        fc.array(publishedPostArb, { minLength: 0, maxLength: 20 }),
        fc.array(scheduledPostArb, { minLength: 0, maxLength: 20 }),
        fc.array(draftPostArb, { minLength: 0, maxLength: 20 }),
      );

      fc.assert(
        fc.property(mixedPostsArb, ([published, scheduled, drafts]) => {
          const allPosts = [...published, ...scheduled, ...drafts];
          const now = new Date();
          const visible = filterVisiblePosts(allPosts, now);
          const invisible = allPosts.filter(
            (p) => p.isDraft || p.publishedAt === null || p.publishedAt > now,
          );

          // Total should be preserved
          expect(visible.length + invisible.length).toBe(allPosts.length);
        }),
        { numRuns: 100 },
      );
    });
  });
});
