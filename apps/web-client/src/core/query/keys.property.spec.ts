/**
 * Query Keys Property-Based Tests
 *
 * Property-based tests using fast-check to verify universal properties
 * that should hold across all valid inputs.
 *
 * Feature: core-architecture-fixes
 */

import * as fc from 'fast-check';
import { queryKeys, createBatchHash } from './keys';

/**
 * Helper to check if a value is a primitive (string, number, null, undefined).
 */
function isPrimitive(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  );
}

/**
 * Helper to check if all elements in an array are primitives.
 */
function allPrimitives(arr: readonly unknown[]): boolean {
  return arr.every(isPrimitive);
}

describe('Query Keys Property Tests', () => {
  /**
   * Property 6: Query keys contain only primitives
   *
   * For any query key factory function in queryKeys, the returned array
   * SHALL contain only values of type string | number | null | undefined,
   * never objects or arrays (except the key array itself).
   *
   * **Validates: Requirements 4.1, 4.5**
   */
  describe('Property 6: Query keys contain only primitives', () => {
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
  });
});


describe('Query Keys Undefined Normalization', () => {
  /**
   * Property 7: Undefined normalization to null
   *
   * For any optional parameter passed as undefined to a query key factory function,
   * the resulting key array SHALL contain null in that position, not undefined.
   *
   * **Validates: Requirements 4.5**
   */
  describe('Property 7: Undefined normalization to null', () => {
    it('shows.trending normalizes undefined to null', () => {
      const key = queryKeys.shows.trending(undefined, undefined, undefined);
      // Check that no undefined values exist in the key
      expect(key.includes(undefined as unknown as string)).toBe(false);
      // Check that null is used for optional params
      expect(key).toEqual(['shows', 'trending', null, null, null]);
    });

    it('shows.calendar normalizes undefined to null', () => {
      const key = queryKeys.shows.calendar(undefined, undefined);
      expect(key.includes(undefined as unknown as string)).toBe(false);
      expect(key).toEqual(['shows', 'calendar', null, null]);
    });

    it('movies.trending normalizes undefined to null', () => {
      const key = queryKeys.movies.trending(undefined, undefined, undefined);
      expect(key.includes(undefined as unknown as string)).toBe(false);
      expect(key).toEqual(['movies', 'trending', null, null, null]);
    });

    it('movies.nowPlaying normalizes undefined to null', () => {
      const key = queryKeys.movies.nowPlaying(undefined, undefined);
      expect(key.includes(undefined as unknown as string)).toBe(false);
      expect(key).toEqual(['movies', 'now-playing', null, null]);
    });

    it('movies.newReleases normalizes undefined to null', () => {
      const key = queryKeys.movies.newReleases(undefined, undefined);
      expect(key.includes(undefined as unknown as string)).toBe(false);
      expect(key).toEqual(['movies', 'new-releases', null, null]);
    });

    it('home.hero normalizes undefined to null', () => {
      const key = queryKeys.home.hero(undefined);
      expect(key.includes(undefined as unknown as string)).toBe(false);
      expect(key).toEqual(['home', 'hero', null]);
    });

    it('insights.movements normalizes undefined to null', () => {
      const key = queryKeys.insights.movements(undefined, undefined);
      expect(key.includes(undefined as unknown as string)).toBe(false);
      expect(key).toEqual(['insights', 'movements', null, null]);
    });

    it('userMedia.myRatings normalizes undefined to null', () => {
      const key = queryKeys.userMedia.myRatings(undefined, undefined);
      expect(key.includes(undefined as unknown as string)).toBe(false);
      expect(key).toEqual(['user-media', 'my-ratings', null, null]);
    });

    it('userMedia.myWatchlist normalizes undefined to null', () => {
      const key = queryKeys.userMedia.myWatchlist(undefined, undefined);
      expect(key.includes(undefined as unknown as string)).toBe(false);
      expect(key).toEqual(['user-media', 'my-watchlist', null, null]);
    });

    it('users.ratings normalizes undefined to null for optional params', () => {
      const key = queryKeys.users.ratings('testuser', undefined, undefined);
      expect(key.includes(undefined as unknown as string)).toBe(false);
      expect(key).toEqual(['users', 'testuser', 'ratings', null, null]);
    });

    it('userActions.savedItems.list normalizes undefined to null', () => {
      const key = queryKeys.userActions.savedItems.list('watchlist', undefined, undefined);
      expect(key.includes(undefined as unknown as string)).toBe(false);
      expect(key).toEqual(['user-actions', 'saved-items', 'list', 'watchlist', null, null]);
    });

    it('userActions.subscriptions.list normalizes undefined to null', () => {
      const key = queryKeys.userActions.subscriptions.list(undefined, undefined);
      expect(key.includes(undefined as unknown as string)).toBe(false);
      expect(key).toEqual(['user-actions', 'subscriptions', 'list', null, null]);
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
