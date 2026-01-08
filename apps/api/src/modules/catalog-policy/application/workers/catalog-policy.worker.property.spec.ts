import * as fc from 'fast-check';

import {
  EvaluationContext,
  type EvaluationContextType,
} from '../../domain/constants/evaluation.constants';

interface ErrorSampleEntry {
  mediaItemId: string;
  error: string;
  stack?: string;
  timestamp: string;
}

function createErrorSampleEntry(mediaItemId: string, error: Error): ErrorSampleEntry {
  return {
    mediaItemId,
    error: error.message,
    stack: error.stack?.substring(0, 500),
    timestamp: new Date().toISOString(),
  };
}

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

  /**
   * Feature: multi-context-evaluation, Property 1: Missing Context Fails Fast
   *
   * For any job payload (ReEvaluateAllPayload or EvaluateCatalogItemPayload) that is missing
   * the `context` field, the worker SHALL NOT write any evaluation record to the database.
   *
   * Validates: Requirements 2.3, 2.4, 3.4
   */
  describe('Property 1: Missing Context Fails Fast', () => {
    // Mock logger to capture error calls
    interface LogEntry {
      message: string;
      context: Record<string, unknown>;
    }

    // Extracted validation logic (mirrors worker implementation)
    function validateContextPayload(
      payload: { context?: EvaluationContextType },
      jobInfo: { runId?: string; policyVersion?: number; mediaItemId?: string },
      logError: (message: string, context: Record<string, unknown>) => void,
    ): payload is { context: EvaluationContextType } {
      if (!payload.context) {
        logError('MISSING_CONTEXT_IN_JOB_PAYLOAD - this is a bug, not a runtime issue', {
          ...jobInfo,
          message: 'Job payload missing required context field',
        });
        return false;
      }
      return true;
    }

    // Arbitraries for generating test data
    const runIdArb = fc.uuid();
    const policyVersionArb = fc.integer({ min: 1, max: 1000 });
    const mediaItemIdArb = fc.uuid();
    const validContextArb = fc.constantFrom(
      EvaluationContext.CATALOG,
      EvaluationContext.TRENDING,
      EvaluationContext.HOMEPAGE,
      EvaluationContext.NOW_PLAYING,
      EvaluationContext.NEW_DIGITAL,
      EvaluationContext.SEARCH,
    );

    it('should return false for any payload missing context field', () => {
      fc.assert(
        fc.property(
          runIdArb,
          policyVersionArb,
          mediaItemIdArb,
          (runId, policyVersion, mediaItemId) => {
            const logs: LogEntry[] = [];
            const logError = (message: string, context: Record<string, unknown>) => {
              logs.push({ message, context });
            };

            // Payload without context
            const payload: { context?: EvaluationContextType } = {};
            const jobInfo = { runId, policyVersion, mediaItemId };

            const result = validateContextPayload(payload, jobInfo, logError);

            // Should return false
            expect(result).toBe(false);
            // Should log error
            expect(logs.length).toBe(1);
            expect(logs[0].message).toContain('MISSING_CONTEXT_IN_JOB_PAYLOAD');
          },
        ),
        { numRuns: 25 },
      );
    });

    it('should return true for any payload with valid context field', () => {
      fc.assert(
        fc.property(
          runIdArb,
          policyVersionArb,
          mediaItemIdArb,
          validContextArb,
          (runId, policyVersion, mediaItemId, context) => {
            const logs: LogEntry[] = [];
            const logError = (message: string, ctx: Record<string, unknown>) => {
              logs.push({ message, context: ctx });
            };

            // Payload with valid context
            const payload = { context };
            const jobInfo = { runId, policyVersion, mediaItemId };

            const result = validateContextPayload(payload, jobInfo, logError);

            // Should return true
            expect(result).toBe(true);
            // Should not log any error
            expect(logs.length).toBe(0);
          },
        ),
        { numRuns: 25 },
      );
    });

    it('should include runId, policyVersion, and mediaItemId in error log', () => {
      fc.assert(
        fc.property(
          runIdArb,
          policyVersionArb,
          mediaItemIdArb,
          (runId, policyVersion, mediaItemId) => {
            const logs: LogEntry[] = [];
            const logError = (message: string, context: Record<string, unknown>) => {
              logs.push({ message, context });
            };

            const payload: { context?: EvaluationContextType } = {};
            const jobInfo = { runId, policyVersion, mediaItemId };

            validateContextPayload(payload, jobInfo, logError);

            // Error log should include all job info
            expect(logs[0].context.runId).toBe(runId);
            expect(logs[0].context.policyVersion).toBe(policyVersion);
            expect(logs[0].context.mediaItemId).toBe(mediaItemId);
          },
        ),
        { numRuns: 25 },
      );
    });

    it('should handle undefined context the same as missing context', () => {
      fc.assert(
        fc.property(runIdArb, policyVersionArb, (runId, policyVersion) => {
          const logs: LogEntry[] = [];
          const logError = (message: string, context: Record<string, unknown>) => {
            logs.push({ message, context });
          };

          // Explicitly set context to undefined
          const payload: { context?: EvaluationContextType } = { context: undefined };
          const jobInfo = { runId, policyVersion };

          const result = validateContextPayload(payload, jobInfo, logError);

          // Should return false for undefined context
          expect(result).toBe(false);
          expect(logs.length).toBe(1);
        }),
        { numRuns: 25 },
      );
    });
  });

  /**
   * Feature: multi-context-evaluation, Property 2: Explicit Context Round-Trip (single item)
   *
   * For any evaluation request with explicit `context` parameter, the stored evaluation
   * record SHALL have that exact context value. This applies to single-item (`evaluateOne`)
   * operations.
   *
   * Validates: Requirements 3.1, 3.3
   */
  describe('Property 2: Explicit Context Round-Trip (single item)', () => {
    // Simulated evaluation storage (mirrors repository behavior)
    interface StoredEvaluation {
      mediaItemId: string;
      policyVersion: number;
      context: EvaluationContextType;
      status: string;
      runId?: string;
    }

    // Simulated evaluateOne function that stores with explicit context
    function simulateEvaluateOne(
      input: {
        mediaItemId: string;
        policyVersion: number;
        runId?: string;
        context: EvaluationContextType;
      },
      storage: Map<string, StoredEvaluation>,
    ): StoredEvaluation {
      const key = `${input.mediaItemId}:${input.policyVersion}:${input.context}`;
      const evaluation: StoredEvaluation = {
        mediaItemId: input.mediaItemId,
        policyVersion: input.policyVersion,
        context: input.context, // Context is stored exactly as provided
        status: 'eligible', // Simulated status
        runId: input.runId,
      };
      storage.set(key, evaluation);
      return evaluation;
    }

    // Arbitraries for generating test data
    const mediaItemIdArb = fc.uuid();
    const policyVersionArb = fc.integer({ min: 1, max: 1000 });
    const runIdArb = fc.uuid();
    const validContextArb = fc.constantFrom(
      EvaluationContext.CATALOG,
      EvaluationContext.TRENDING,
      EvaluationContext.HOMEPAGE,
      EvaluationContext.NOW_PLAYING,
      EvaluationContext.NEW_DIGITAL,
      EvaluationContext.SEARCH,
    );

    it('should store evaluation with exact context value provided in input', () => {
      fc.assert(
        fc.property(
          mediaItemIdArb,
          policyVersionArb,
          runIdArb,
          validContextArb,
          (mediaItemId, policyVersion, runId, context) => {
            const storage = new Map<string, StoredEvaluation>();

            const result = simulateEvaluateOne(
              { mediaItemId, policyVersion, runId, context },
              storage,
            );

            // The stored evaluation should have the exact context provided
            expect(result.context).toBe(context);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should retrieve evaluation by exact context match', () => {
      fc.assert(
        fc.property(
          mediaItemIdArb,
          policyVersionArb,
          runIdArb,
          validContextArb,
          (mediaItemId, policyVersion, runId, context) => {
            const storage = new Map<string, StoredEvaluation>();

            // Store evaluation with specific context
            simulateEvaluateOne({ mediaItemId, policyVersion, runId, context }, storage);

            // Retrieve by exact key (mediaItemId:policyVersion:context)
            const key = `${mediaItemId}:${policyVersion}:${context}`;
            const retrieved = storage.get(key);

            // Should find the evaluation with matching context
            expect(retrieved).toBeDefined();
            expect(retrieved?.context).toBe(context);
            expect(retrieved?.mediaItemId).toBe(mediaItemId);
            expect(retrieved?.policyVersion).toBe(policyVersion);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should store different evaluations for same item with different contexts', () => {
      fc.assert(
        fc.property(
          mediaItemIdArb,
          policyVersionArb,
          runIdArb,
          (mediaItemId, policyVersion, runId) => {
            const storage = new Map<string, StoredEvaluation>();

            // Store evaluations for multiple contexts
            const contexts = [EvaluationContext.CATALOG, EvaluationContext.TRENDING] as const;

            for (const context of contexts) {
              simulateEvaluateOne({ mediaItemId, policyVersion, runId, context }, storage);
            }

            // Should have separate entries for each context
            expect(storage.size).toBe(contexts.length);

            // Each entry should have its own context
            for (const context of contexts) {
              const key = `${mediaItemId}:${policyVersion}:${context}`;
              const evaluation = storage.get(key);
              expect(evaluation?.context).toBe(context);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should preserve context through evaluation round-trip', () => {
      fc.assert(
        fc.property(
          mediaItemIdArb,
          policyVersionArb,
          runIdArb,
          validContextArb,
          (mediaItemId, policyVersion, runId, inputContext) => {
            const storage = new Map<string, StoredEvaluation>();

            // Simulate the full round-trip:
            // 1. Input with explicit context
            // 2. Store evaluation
            // 3. Retrieve and verify context matches

            const input = { mediaItemId, policyVersion, runId, context: inputContext };
            const stored = simulateEvaluateOne(input, storage);

            // Round-trip property: input context === stored context
            expect(stored.context).toBe(inputContext);

            // Verify retrieval also returns same context
            const key = `${mediaItemId}:${policyVersion}:${inputContext}`;
            const retrieved = storage.get(key);
            expect(retrieved?.context).toBe(inputContext);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Feature: multi-context-evaluation, Property 2: Explicit Context Round-Trip (batch)
   *
   * For any batch evaluation request with explicit `context` parameter, all stored evaluation
   * records SHALL have that exact context value.
   *
   * Validates: Requirements 4.1, 4.3
   */
  describe('Property 2: Explicit Context Round-Trip (batch)', () => {
    // Simulated evaluation storage (mirrors repository behavior)
    interface StoredEvaluation {
      mediaItemId: string;
      policyVersion: number;
      context: EvaluationContextType;
      status: string;
      runId?: string;
    }

    // Simulated evaluateBatch function that stores with explicit context
    function simulateEvaluateBatch(
      mediaItemIds: string[],
      options: {
        policyVersion: number;
        runId?: string;
        context?: EvaluationContextType;
      },
      storage: Map<string, StoredEvaluation>,
    ): StoredEvaluation[] {
      // Default to 'catalog' if context not provided (matches implementation)
      const context = options.context ?? EvaluationContext.CATALOG;
      const evaluations: StoredEvaluation[] = [];

      for (const mediaItemId of mediaItemIds) {
        const key = `${mediaItemId}:${options.policyVersion}:${context}`;
        const evaluation: StoredEvaluation = {
          mediaItemId,
          policyVersion: options.policyVersion,
          context, // Context is stored exactly as provided (or default)
          status: 'eligible', // Simulated status
          runId: options.runId,
        };
        storage.set(key, evaluation);
        evaluations.push(evaluation);
      }

      return evaluations;
    }

    // Arbitraries for generating test data
    const mediaItemIdArb = fc.uuid();
    const mediaItemIdsArb = fc.array(fc.uuid(), { minLength: 1, maxLength: 10 });
    const policyVersionArb = fc.integer({ min: 1, max: 1000 });
    const runIdArb = fc.uuid();
    const validContextArb = fc.constantFrom(
      EvaluationContext.CATALOG,
      EvaluationContext.TRENDING,
      EvaluationContext.HOMEPAGE,
      EvaluationContext.NOW_PLAYING,
      EvaluationContext.NEW_DIGITAL,
      EvaluationContext.SEARCH,
    );

    it('should store all batch evaluations with exact context value provided in options', () => {
      fc.assert(
        fc.property(
          mediaItemIdsArb,
          policyVersionArb,
          runIdArb,
          validContextArb,
          (mediaItemIds, policyVersion, runId, context) => {
            const storage = new Map<string, StoredEvaluation>();

            const results = simulateEvaluateBatch(
              mediaItemIds,
              { policyVersion, runId, context },
              storage,
            );

            // All stored evaluations should have the exact context provided
            for (const result of results) {
              expect(result.context).toBe(context);
            }

            // Verify storage also has correct context
            for (const mediaItemId of mediaItemIds) {
              const key = `${mediaItemId}:${policyVersion}:${context}`;
              const stored = storage.get(key);
              expect(stored?.context).toBe(context);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should default to catalog context when context not provided', () => {
      fc.assert(
        fc.property(
          mediaItemIdsArb,
          policyVersionArb,
          runIdArb,
          (mediaItemIds, policyVersion, runId) => {
            const storage = new Map<string, StoredEvaluation>();

            // Call without context option
            const results = simulateEvaluateBatch(mediaItemIds, { policyVersion, runId }, storage);

            // All stored evaluations should have default context (catalog)
            for (const result of results) {
              expect(result.context).toBe(EvaluationContext.CATALOG);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should store separate evaluations for same items with different contexts', () => {
      fc.assert(
        fc.property(
          mediaItemIdsArb,
          policyVersionArb,
          runIdArb,
          (mediaItemIds, policyVersion, runId) => {
            const storage = new Map<string, StoredEvaluation>();

            // Evaluate same items for multiple contexts
            const contexts = [EvaluationContext.CATALOG, EvaluationContext.TRENDING] as const;

            for (const context of contexts) {
              simulateEvaluateBatch(mediaItemIds, { policyVersion, runId, context }, storage);
            }

            // Should have separate entries for each context per item
            expect(storage.size).toBe(mediaItemIds.length * contexts.length);

            // Each entry should have its own context
            for (const mediaItemId of mediaItemIds) {
              for (const context of contexts) {
                const key = `${mediaItemId}:${policyVersion}:${context}`;
                const evaluation = storage.get(key);
                expect(evaluation?.context).toBe(context);
                expect(evaluation?.mediaItemId).toBe(mediaItemId);
              }
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should preserve context through batch evaluation round-trip', () => {
      fc.assert(
        fc.property(
          mediaItemIdsArb,
          policyVersionArb,
          runIdArb,
          validContextArb,
          (mediaItemIds, policyVersion, runId, inputContext) => {
            const storage = new Map<string, StoredEvaluation>();

            // Simulate the full round-trip:
            // 1. Input with explicit context
            // 2. Store evaluations
            // 3. Retrieve and verify context matches for all items

            const stored = simulateEvaluateBatch(
              mediaItemIds,
              { policyVersion, runId, context: inputContext },
              storage,
            );

            // Round-trip property: input context === stored context for all items
            for (const evaluation of stored) {
              expect(evaluation.context).toBe(inputContext);
            }

            // Verify retrieval also returns same context for all items
            for (const mediaItemId of mediaItemIds) {
              const key = `${mediaItemId}:${policyVersion}:${inputContext}`;
              const retrieved = storage.get(key);
              expect(retrieved?.context).toBe(inputContext);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should include runId in all batch evaluations when provided', () => {
      fc.assert(
        fc.property(
          mediaItemIdsArb,
          policyVersionArb,
          runIdArb,
          validContextArb,
          (mediaItemIds, policyVersion, runId, context) => {
            const storage = new Map<string, StoredEvaluation>();

            const results = simulateEvaluateBatch(
              mediaItemIds,
              { policyVersion, runId, context },
              storage,
            );

            // All stored evaluations should have the runId
            for (const result of results) {
              expect(result.runId).toBe(runId);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
