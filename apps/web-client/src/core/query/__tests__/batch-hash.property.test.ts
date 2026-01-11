/**
 * Property-based tests for deterministic batch hash.
 */

import * as fc from 'fast-check';
import { createBatchHash } from '../keys';

describe('Deterministic batch hash', () => {
  /**
   * Property 5: Deterministic batch hash
   *
   * For any two arrays of mediaItemIds that contain the same set of IDs
   * (regardless of order or duplicates), createBatchHash() SHALL return
   * identical strings.
   */
  it('Property 5: same IDs in different order produce identical hash', () => {
    fc.assert(
      fc.property(fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }), (ids) => {
        // Shuffle the array
        const shuffled = [...ids].sort(() => Math.random() - 0.5);

        const hash1 = createBatchHash(ids);
        const hash2 = createBatchHash(shuffled);

        expect(hash1).toBe(hash2);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Duplicates don't affect the hash
   */
  it('duplicates in input produce same hash as deduplicated input', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 1, max: 5 }),
        (ids, duplicateCount) => {
          // Create array with duplicates
          const withDuplicates = [...ids];
          for (let i = 0; i < duplicateCount; i++) {
            const randomId = ids[Math.floor(Math.random() * ids.length)];
            withDuplicates.push(randomId);
          }

          const hashOriginal = createBatchHash(ids);
          const hashWithDuplicates = createBatchHash(withDuplicates);

          expect(hashOriginal).toBe(hashWithDuplicates);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Hash is deterministic (same input always produces same output)
   */
  it('same input always produces same hash', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }),
        fc.integer({ min: 2, max: 10 }),
        (ids, iterations) => {
          const hashes: string[] = [];

          for (let i = 0; i < iterations; i++) {
            hashes.push(createBatchHash(ids));
          }

          // All hashes should be identical
          const firstHash = hashes[0];
          expect(hashes.every((h) => h === firstHash)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Hash output is sorted and comma-separated
   */
  it('hash output is sorted ascending and comma-separated', () => {
    fc.assert(
      fc.property(fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }), (ids) => {
        const hash = createBatchHash(ids);
        const parts = hash.split(',');

        // Parts should be sorted
        const sortedParts = [...parts].sort();
        expect(parts).toEqual(sortedParts);

        // Parts should be unique
        const uniqueParts = [...new Set(parts)];
        expect(parts).toEqual(uniqueParts);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Empty array produces empty string
   */
  it('empty array produces empty string', () => {
    expect(createBatchHash([])).toBe('');
  });

  /**
   * Property: Single ID produces that ID as hash
   */
  it('single ID produces that ID as hash', () => {
    fc.assert(
      fc.property(fc.uuid(), (id) => {
        expect(createBatchHash([id])).toBe(id);
      }),
      { numRuns: 100 },
    );
  });
});
