// Property-based tests for query keys using fast-check

import * as fc from 'fast-check';
import { queryKeys, createBatchHash } from './keys';

function isPrimitive(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

function allPrimitives(arr: readonly unknown[]): boolean {
  return arr.every(isPrimitive);
}

describe('Query Keys Property Tests', () => {
  describe('Query keys contain only primitives', () => {
    it('shows.trending returns only primitive values', () => {
      fc.assert(
        fc.property(
          fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
          fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
          (limit, offset, sort) => {
            const key = queryKeys.shows.trending(limit, offset, sort);
            expect(allPrimitives(key)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('shows.calendar returns only primitive values', () => {
      fc.assert(
        fc.property(
          fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
          fc.option(fc.integer({ min: 1, max: 30 }), { nil: undefined }),
          (startDate, days) => {
            const key = queryKeys.shows.calendar(startDate, days);
            expect(allPrimitives(key)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('movies.trending returns only primitive values', () => {
      fc.assert(
        fc.property(
          fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
          fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
          (limit, offset, sort) => {
            const key = queryKeys.movies.trending(limit, offset, sort);
            expect(allPrimitives(key)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('movies.nowPlaying returns only primitive values', () => {
      fc.assert(
        fc.property(
          fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
          (limit, offset) => {
            const key = queryKeys.movies.nowPlaying(limit, offset);
            expect(allPrimitives(key)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('movies.newReleases returns only primitive values', () => {
      fc.assert(
        fc.property(
          fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
          (limit, offset) => {
            const key = queryKeys.movies.newReleases(limit, offset);
            expect(allPrimitives(key)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('home.hero returns only primitive values', () => {
      fc.assert(
        fc.property(
          fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
          (type) => {
            const key = queryKeys.home.hero(type);
            expect(allPrimitives(key)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('insights.movements returns only primitive values', () => {
      fc.assert(
        fc.property(
          fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
          fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          (window, limit) => {
            const key = queryKeys.insights.movements(window, limit);
            expect(allPrimitives(key)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('userMedia.myRatings returns only primitive values', () => {
      fc.assert(
        fc.property(
          fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
          (limit, offset) => {
            const key = queryKeys.userMedia.myRatings(limit, offset);
            expect(allPrimitives(key)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('userMedia.myWatchlist returns only primitive values', () => {
      fc.assert(
        fc.property(
          fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
          (limit, offset) => {
            const key = queryKeys.userMedia.myWatchlist(limit, offset);
            expect(allPrimitives(key)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('users.ratings returns only primitive values', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
          (username, limit, offset) => {
            const key = queryKeys.users.ratings(username, limit, offset);
            expect(allPrimitives(key)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('userActions.savedItems.list returns only primitive values', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
          (list, limit, offset) => {
            const key = queryKeys.userActions.savedItems.list(list, limit, offset);
            expect(allPrimitives(key)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('userActions.subscriptions.list returns only primitive values', () => {
      fc.assert(
        fc.property(
          fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
          (limit, offset) => {
            const key = queryKeys.userActions.subscriptions.list(limit, offset);
            expect(allPrimitives(key)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('journal.list returns only primitive values', () => {
      fc.assert(
        fc.property(
          fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          fc.option(fc.integer({ min: 1, max: 50 }), { nil: undefined }),
          fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
          (page, limit, types) => {
            const key = queryKeys.journal.list(page, limit, types);
            expect(allPrimitives(key)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('admin.journal.list returns only primitive values', () => {
      fc.assert(
        fc.property(
          fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          fc.option(fc.integer({ min: 1, max: 50 }), { nil: undefined }),
          fc.option(fc.constantFrom('draft', 'published', 'scheduled'), { nil: undefined }),
          (page, limit, status) => {
            const key = queryKeys.admin.journal.list(page, limit, status);
            expect(allPrimitives(key)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

describe('Query Keys Undefined Normalization', () => {
  describe('Undefined normalization to null', () => {
    it('shows.trending normalizes undefined to null', () => {
      const key = queryKeys.shows.trending(undefined, undefined, undefined);
      expect((key as readonly unknown[]).includes(undefined)).toBe(false);
      expect(key).toEqual(['shows', 'trending', null, null, null]);
    });

    it('shows.calendar normalizes undefined to null', () => {
      const key = queryKeys.shows.calendar(undefined, undefined);
      expect((key as readonly unknown[]).includes(undefined)).toBe(false);
      expect(key).toEqual(['shows', 'calendar', null, null]);
    });

    it('movies.trending normalizes undefined to null', () => {
      const key = queryKeys.movies.trending(undefined, undefined, undefined);
      expect((key as readonly unknown[]).includes(undefined)).toBe(false);
      expect(key).toEqual(['movies', 'trending', null, null, null]);
    });

    it('movies.nowPlaying normalizes undefined to null', () => {
      const key = queryKeys.movies.nowPlaying(undefined, undefined);
      expect((key as readonly unknown[]).includes(undefined)).toBe(false);
      expect(key).toEqual(['movies', 'now-playing', null, null]);
    });

    it('movies.newReleases normalizes undefined to null', () => {
      const key = queryKeys.movies.newReleases(undefined, undefined);
      expect((key as readonly unknown[]).includes(undefined)).toBe(false);
      expect(key).toEqual(['movies', 'new-releases', null, null]);
    });

    it('home.hero normalizes undefined to null', () => {
      const key = queryKeys.home.hero(undefined);
      expect((key as readonly unknown[]).includes(undefined)).toBe(false);
      expect(key).toEqual(['home', 'hero', null]);
    });

    it('insights.movements normalizes undefined to null', () => {
      const key = queryKeys.insights.movements(undefined, undefined);
      expect((key as readonly unknown[]).includes(undefined)).toBe(false);
      expect(key).toEqual(['insights', 'movements', null, null]);
    });

    it('userMedia.myRatings normalizes undefined to null', () => {
      const key = queryKeys.userMedia.myRatings(undefined, undefined);
      expect((key as readonly unknown[]).includes(undefined)).toBe(false);
      expect(key).toEqual(['user-media', 'my-ratings', null, null]);
    });

    it('userMedia.myWatchlist normalizes undefined to null', () => {
      const key = queryKeys.userMedia.myWatchlist(undefined, undefined);
      expect((key as readonly unknown[]).includes(undefined)).toBe(false);
      expect(key).toEqual(['user-media', 'my-watchlist', null, null]);
    });

    it('users.ratings normalizes undefined to null for optional params', () => {
      const key = queryKeys.users.ratings('testuser', undefined, undefined);
      expect((key as readonly unknown[]).includes(undefined)).toBe(false);
      expect(key).toEqual(['users', 'testuser', 'ratings', null, null]);
    });

    it('userActions.savedItems.list normalizes undefined to null', () => {
      const key = queryKeys.userActions.savedItems.list('watchlist', undefined, undefined);
      expect((key as readonly unknown[]).includes(undefined)).toBe(false);
      expect(key).toEqual(['user-actions', 'saved-items', 'list', 'watchlist', null, null]);
    });

    it('userActions.subscriptions.list normalizes undefined to null', () => {
      const key = queryKeys.userActions.subscriptions.list(undefined, undefined);
      expect((key as readonly unknown[]).includes(undefined)).toBe(false);
      expect(key).toEqual(['user-actions', 'subscriptions', 'list', null, null]);
    });

    it('journal.list normalizes undefined to null', () => {
      const key = queryKeys.journal.list(undefined, undefined, undefined);
      expect((key as readonly unknown[]).includes(undefined)).toBe(false);
      expect(key).toEqual(['journal', 'list', null, null, null]);
    });

    it('journal.detail returns correct key', () => {
      const key = queryKeys.journal.detail('test-slug');
      expect(key).toEqual(['journal', 'detail', 'test-slug']);
    });

    it('admin.journal.list normalizes undefined to null', () => {
      const key = queryKeys.admin.journal.list(undefined, undefined, undefined);
      expect((key as readonly unknown[]).includes(undefined)).toBe(false);
      expect(key).toEqual(['admin', 'journal', 'list', null, null, null]);
    });

    it('admin.journal.detail returns correct key', () => {
      const key = queryKeys.admin.journal.detail('test-id');
      expect(key).toEqual(['admin', 'journal', 'detail', 'test-id']);
    });

    // Property-based test: for any combination of defined/undefined params,
    // the result should never contain undefined
    it('no query key function returns undefined in the array (property test)', () => {
      fc.assert(
        fc.property(
          fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
          fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
          fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
          (limit, offset, sort) => {
            const keys = [
              queryKeys.shows.trending(limit, offset, sort),
              queryKeys.movies.trending(limit, offset, sort),
              queryKeys.movies.nowPlaying(limit, offset),
              queryKeys.movies.newReleases(limit, offset),
            ];

            for (const key of keys) {
              // No element should be undefined
              expect(key.some((el) => el === undefined)).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
