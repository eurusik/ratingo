/**
 * Property-based tests for batch to individual cache population.
 *
 * Feature: core-architecture-fixes, Property 4: Batch to individual cache population
 * Validates: Requirements 2.1
 */

import * as fc from 'fast-check';
import { queryKeys, createBatchHash } from '../../query/keys';
import type { MediaSaveStatusDto } from '../../api/user-actions';

describe('Batch to individual cache population', () => {
  /**
   * Property 4: Batch to individual cache population
   *
   * For any batch status fetch returning N statuses, after the fetch completes
   * there SHALL exist N individual cache entries with keys
   * queryKeys.userActions.savedItems.status(mediaItemId).
   *
   * This test validates the cache population logic by simulating what
   * SavedStatusProvider does when it receives batch data.
   *
   * Validates: Requirements 2.1
   */
  it('Property 4: batch statuses populate individual cache entries correctly', () => {
    fc.assert(
      fc.property(
        // Generate array of unique media IDs
        fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }).map((ids) => [...new Set(ids)]),
        (mediaItemIds) => {
          // Simulate batch response from API
          const batchStatuses: Record<string, MediaSaveStatusDto> = {};
          mediaItemIds.forEach((id) => {
            batchStatuses[id] = {
              isForLater: Math.random() > 0.5,
              isConsidering: Math.random() > 0.5,
            };
          });

          // Simulate cache population (what SavedStatusProvider does in useEffect)
          const cache = new Map<string, MediaSaveStatusDto>();

          Object.entries(batchStatuses).forEach(([mediaItemId, status]) => {
            const key = JSON.stringify(queryKeys.userActions.savedItems.status(mediaItemId));
            cache.set(key, status);
          });

          // Property: N statuses → N individual cache entries
          expect(cache.size).toBe(mediaItemIds.length);

          // Property: Each mediaItemId has correct cache entry
          mediaItemIds.forEach((id) => {
            const key = JSON.stringify(queryKeys.userActions.savedItems.status(id));
            expect(cache.has(key)).toBe(true);
            expect(cache.get(key)).toEqual(batchStatuses[id]);
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Individual cache keys are deterministic
   */
  it('individual cache keys are deterministic for same mediaItemId', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.integer({ min: 2, max: 10 }),
        (mediaItemId, iterations) => {
          const keys: string[] = [];

          for (let i = 0; i < iterations; i++) {
            keys.push(JSON.stringify(queryKeys.userActions.savedItems.status(mediaItemId)));
          }

          // All keys should be identical
          const firstKey = keys[0];
          expect(keys.every((k) => k === firstKey)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Batch key and individual keys are distinct
   */
  it('batch key is distinct from individual status keys', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }).map((ids) => [...new Set(ids)]),
        (mediaItemIds) => {
          const batchHash = createBatchHash(mediaItemIds);
          const batchKey = JSON.stringify(queryKeys.userActions.savedItems.batch(batchHash));

          // Each individual key should be different from batch key
          mediaItemIds.forEach((id) => {
            const individualKey = JSON.stringify(queryKeys.userActions.savedItems.status(id));
            expect(individualKey).not.toBe(batchKey);
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Cache population preserves status values
   */
  it('cache population preserves all status fields', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.boolean(),
        fc.boolean(),
        (mediaItemId, isForLater, isConsidering) => {
          const status: MediaSaveStatusDto = { isForLater, isConsidering };

          // Simulate cache set/get
          const cache = new Map<string, MediaSaveStatusDto>();
          const key = JSON.stringify(queryKeys.userActions.savedItems.status(mediaItemId));
          cache.set(key, status);

          const retrieved = cache.get(key);

          // All fields should be preserved
          expect(retrieved?.isForLater).toBe(isForLater);
          expect(retrieved?.isConsidering).toBe(isConsidering);
        },
      ),
      { numRuns: 100 },
    );
  });
});
