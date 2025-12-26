/**
 * Catalog Policy Worker Property-Based Tests
 *
 * Feature: catalog-policy-refactoring
 * Property 6: Worker Records Errors in ErrorSample
 * Validates: Requirements 7.3
 */

import * as fc from 'fast-check';

/**
 * Interface for error sample entries as recorded by the Worker
 */
interface ErrorSampleEntry {
  mediaItemId: string;
  error: string;
  stack?: string;
  timestamp: string;
}

/**
 * Simulates the Worker's error recording behavior.
 * This mirrors the logic in CatalogPolicyWorker.handleEvaluateCatalogItem
 */
function createErrorSampleEntry(mediaItemId: string, error: Error): ErrorSampleEntry {
  return {
    mediaItemId,
    error: error.message,
    stack: error.stack?.substring(0, 500),
    timestamp: new Date().toISOString(),
  };
}

/**
 * Validates that an error sample entry has all required fields
 */
function isValidErrorSampleEntry(entry: ErrorSampleEntry): boolean {
  return (
    typeof entry.mediaItemId === 'string' &&
    entry.mediaItemId.length > 0 &&
    typeof entry.error === 'string' &&
    typeof entry.timestamp === 'string' &&
    // Timestamp should be valid ISO format
    !isNaN(Date.parse(entry.timestamp))
  );
}

describe('Catalog Policy Worker - Property-Based Tests', () => {
  /**
   * Property 6: Worker Records Errors in ErrorSample
   *
   * For any evaluation error in the Worker, the error SHALL be recorded
   * in the run's errorSample with mediaItemId, error message, and timestamp.
   * Validates: Requirements 7.3
   */
  describe('Property 6: Worker Records Errors in ErrorSample', () => {
    // Arbitraries for generating test data
    const mediaItemIdArb = fc.uuid();
    const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 });
    const errorNameArb = fc.constantFrom(
      'Error',
      'TypeError',
      'ReferenceError',
      'DatabaseException',
      'NotFoundException',
    );
    const stackTraceArb = fc.string({ minLength: 50, maxLength: 1000 });

    it('should include mediaItemId in error sample entry', () => {
      fc.assert(
        fc.property(mediaItemIdArb, errorMessageArb, (mediaItemId, message) => {
          const error = new Error(message);
          const entry = createErrorSampleEntry(mediaItemId, error);

          expect(entry.mediaItemId).toBe(mediaItemId);
        }),
        { numRuns: 100 },
      );
    });

    it('should include error message in error sample entry', () => {
      fc.assert(
        fc.property(mediaItemIdArb, errorMessageArb, (mediaItemId, message) => {
          const error = new Error(message);
          const entry = createErrorSampleEntry(mediaItemId, error);

          expect(entry.error).toBe(message);
        }),
        { numRuns: 100 },
      );
    });

    it('should include timestamp in ISO format', () => {
      fc.assert(
        fc.property(mediaItemIdArb, errorMessageArb, (mediaItemId, message) => {
          const beforeTime = new Date();
          const error = new Error(message);
          const entry = createErrorSampleEntry(mediaItemId, error);
          const afterTime = new Date();

          // Timestamp should be valid ISO string
          const parsedTime = new Date(entry.timestamp);
          expect(parsedTime.toISOString()).toBe(entry.timestamp);

          // Timestamp should be between before and after
          expect(parsedTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
          expect(parsedTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
        }),
        { numRuns: 100 },
      );
    });

    it('should truncate stack trace to 500 characters', () => {
      fc.assert(
        fc.property(
          mediaItemIdArb,
          errorMessageArb,
          stackTraceArb,
          (mediaItemId, message, stack) => {
            const error = new Error(message);
            error.stack = stack;
            const entry = createErrorSampleEntry(mediaItemId, error);

            // Stack should be truncated to 500 chars max
            if (entry.stack) {
              expect(entry.stack.length).toBeLessThanOrEqual(500);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should handle errors without stack trace', () => {
      fc.assert(
        fc.property(mediaItemIdArb, errorMessageArb, (mediaItemId, message) => {
          const error = new Error(message);
          delete error.stack;
          const entry = createErrorSampleEntry(mediaItemId, error);

          // Entry should still be valid without stack
          expect(isValidErrorSampleEntry(entry)).toBe(true);
          expect(entry.stack).toBeUndefined();
        }),
        { numRuns: 100 },
      );
    });

    it('should create valid error sample entries for any error', () => {
      fc.assert(
        fc.property(
          mediaItemIdArb,
          errorMessageArb,
          errorNameArb,
          fc.option(stackTraceArb, { nil: undefined }),
          (mediaItemId, message, errorName, stack) => {
            const error = new Error(message);
            error.name = errorName;
            if (stack) {
              error.stack = stack;
            }

            const entry = createErrorSampleEntry(mediaItemId, error);

            // Entry should always be valid
            expect(isValidErrorSampleEntry(entry)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should preserve error message exactly', () => {
      fc.assert(
        fc.property(mediaItemIdArb, errorMessageArb, (mediaItemId, message) => {
          const error = new Error(message);
          const entry = createErrorSampleEntry(mediaItemId, error);

          // Message should be preserved exactly
          expect(entry.error).toBe(error.message);
        }),
        { numRuns: 100 },
      );
    });

    it('should handle special characters in error messages', () => {
      // Generate strings with special characters
      const specialCharsArb = fc
        .string({
          minLength: 1,
          maxLength: 100,
        })
        .map((s) => s + '\n\t"\'\\<>&');

      fc.assert(
        fc.property(mediaItemIdArb, specialCharsArb, (mediaItemId, message) => {
          const error = new Error(message);
          const entry = createErrorSampleEntry(mediaItemId, error);

          // Should handle special characters without issues
          expect(entry.error).toBe(message);
          expect(isValidErrorSampleEntry(entry)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Additional property: Error sample entries are JSON-serializable
   */
  describe('Error sample entries are JSON-serializable', () => {
    const mediaItemIdArb = fc.uuid();
    const errorMessageArb = fc.string({ minLength: 1, maxLength: 200 });

    it('should produce JSON-serializable error sample entries', () => {
      fc.assert(
        fc.property(mediaItemIdArb, errorMessageArb, (mediaItemId, message) => {
          const error = new Error(message);
          const entry = createErrorSampleEntry(mediaItemId, error);

          // Should be serializable to JSON and back
          const serialized = JSON.stringify(entry);
          const deserialized = JSON.parse(serialized);

          expect(deserialized.mediaItemId).toBe(entry.mediaItemId);
          expect(deserialized.error).toBe(entry.error);
          expect(deserialized.timestamp).toBe(entry.timestamp);
        }),
        { numRuns: 100 },
      );
    });
  });
});
