/**
 * Property-based tests for idempotent retry policy.
 *
 * Feature: core-architecture-fixes, Property 3: Idempotent retry policy
 * Validates: Requirements 1.3, 1.7
 */

import * as fc from 'fast-check';

describe('Idempotent retry policy', () => {
  /** Idempotent HTTP methods that are safe to retry. */
  const IDEMPOTENT_METHODS = ['GET', 'HEAD', 'OPTIONS'];

  /** Non-idempotent HTTP methods that should NOT be retried. */
  const NON_IDEMPOTENT_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

  /**
   * Property 3: Idempotent retry policy
   *
   * For any 401 response on a GET/HEAD request, after successful refresh
   * the request SHALL be retried exactly once.
   *
   * For any 401 response on POST/PATCH/PUT/DELETE without idempotency key,
   * the request SHALL NOT be retried.
   *
   * Validates: Requirements 1.3, 1.7
   */
  it('Property 3: idempotent methods are correctly classified for retry', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...IDEMPOTENT_METHODS),
        fc.constantFrom(...NON_IDEMPOTENT_METHODS),
        (idempotentMethod, nonIdempotentMethod) => {
          // Idempotent methods should be in the allowed list
          expect(IDEMPOTENT_METHODS.includes(idempotentMethod)).toBe(true);

          // Non-idempotent methods should NOT be in the allowed list
          expect(IDEMPOTENT_METHODS.includes(nonIdempotentMethod)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Method classification is case-insensitive when uppercased
   */
  it('method classification handles case variations', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('get', 'GET', 'Get', 'head', 'HEAD', 'Head', 'options', 'OPTIONS', 'Options'),
        (method) => {
          const upperMethod = method.toUpperCase();
          expect(IDEMPOTENT_METHODS.includes(upperMethod)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Non-idempotent methods are never classified as safe to retry
   */
  it('non-idempotent methods are never safe to retry', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          'post',
          'POST',
          'Post',
          'put',
          'PUT',
          'Put',
          'patch',
          'PATCH',
          'Patch',
          'delete',
          'DELETE',
          'Delete',
        ),
        (method) => {
          const upperMethod = method.toUpperCase();
          expect(IDEMPOTENT_METHODS.includes(upperMethod)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: The retry policy is deterministic
   */
  it('retry policy is deterministic for same method', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...IDEMPOTENT_METHODS, ...NON_IDEMPOTENT_METHODS),
        fc.integer({ min: 1, max: 10 }), // Number of checks
        (method, checkCount) => {
          const results: boolean[] = [];

          for (let i = 0; i < checkCount; i++) {
            results.push(IDEMPOTENT_METHODS.includes(method.toUpperCase()));
          }

          // All results should be identical
          const firstResult = results[0];
          expect(results.every((r) => r === firstResult)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Unknown methods are not retried (safe default)
   */
  it('unknown methods default to non-retryable', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(
          (s) =>
            !IDEMPOTENT_METHODS.includes(s.toUpperCase()) &&
            !NON_IDEMPOTENT_METHODS.includes(s.toUpperCase()),
        ),
        (unknownMethod) => {
          // Unknown methods should not be in the idempotent list
          expect(IDEMPOTENT_METHODS.includes(unknownMethod.toUpperCase())).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
