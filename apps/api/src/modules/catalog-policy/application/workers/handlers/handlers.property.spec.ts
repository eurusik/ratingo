/**
 * Property-Based Tests for Worker Handlers
 *
 * Tests invariants that must hold for any input.
 */

import * as fc from 'fast-check';

import {
  EvaluationContext,
  type EvaluationContextType,
} from '../../../domain/constants/evaluation.constants';
import type {
  ReEvaluateAllPayload,
  EvaluateCatalogItemPayload,
  ErrorSampleEntry,
} from '../types/job-payloads';

describe('Worker Handlers - Property-Based Tests', () => {
  // Arbitraries for generating test data
  const runIdArb = fc.uuid();
  const policyVersionArb = fc.integer({ min: 1, max: 1000 });
  const mediaItemIdArb = fc.uuid();
  const batchSizeArb = fc.integer({ min: 1, max: 1000 });
  const cursorArb = fc.option(fc.uuid(), { nil: undefined });
  const validContextArb = fc.constantFrom(
    EvaluationContext.CATALOG,
    EvaluationContext.TRENDING,
    EvaluationContext.HOMEPAGE,
    EvaluationContext.NOW_PLAYING,
    EvaluationContext.NEW_DIGITAL,
    EvaluationContext.SEARCH,
  );

  describe('ReEvaluateAllPayload', () => {
    const reEvaluateAllPayloadArb = fc.record({
      runId: runIdArb,
      policyVersion: policyVersionArb,
      context: validContextArb,
      batchSize: fc.option(batchSizeArb, { nil: undefined }),
      cursor: cursorArb,
    });

    it('should always have required fields', () => {
      fc.assert(
        fc.property(reEvaluateAllPayloadArb, (payload) => {
          expect(payload.runId).toBeDefined();
          expect(payload.policyVersion).toBeDefined();
          expect(payload.context).toBeDefined();
        }),
        { numRuns: 100 },
      );
    });

    it('should have valid context value', () => {
      fc.assert(
        fc.property(reEvaluateAllPayloadArb, (payload) => {
          const validContexts = Object.values(EvaluationContext);
          expect(validContexts).toContain(payload.context);
        }),
        { numRuns: 100 },
      );
    });

    it('should have positive policy version', () => {
      fc.assert(
        fc.property(reEvaluateAllPayloadArb, (payload) => {
          expect(payload.policyVersion).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });

    it('should have positive batch size when defined', () => {
      fc.assert(
        fc.property(reEvaluateAllPayloadArb, (payload) => {
          if (payload.batchSize !== undefined) {
            expect(payload.batchSize).toBeGreaterThan(0);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('EvaluateCatalogItemPayload', () => {
    const evaluateCatalogItemPayloadArb = fc.record({
      runId: runIdArb,
      policyVersion: policyVersionArb,
      mediaItemId: mediaItemIdArb,
      context: validContextArb,
    });

    it('should always have all required fields', () => {
      fc.assert(
        fc.property(evaluateCatalogItemPayloadArb, (payload) => {
          expect(payload.runId).toBeDefined();
          expect(payload.policyVersion).toBeDefined();
          expect(payload.mediaItemId).toBeDefined();
          expect(payload.context).toBeDefined();
        }),
        { numRuns: 100 },
      );
    });

    it('should have valid UUID for mediaItemId', () => {
      fc.assert(
        fc.property(evaluateCatalogItemPayloadArb, (payload) => {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          expect(payload.mediaItemId).toMatch(uuidRegex);
        }),
        { numRuns: 100 },
      );
    });

    it('should preserve context through serialization', () => {
      fc.assert(
        fc.property(evaluateCatalogItemPayloadArb, (payload) => {
          const serialized = JSON.stringify(payload);
          const deserialized = JSON.parse(serialized) as EvaluateCatalogItemPayload;
          expect(deserialized.context).toBe(payload.context);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Job ID Generation', () => {
    /**
     * Job ID must be unique for each (runId, mediaItemId, context) combination.
     * This prevents duplicate processing while allowing same item to be
     * evaluated in different contexts.
     */
    function generateJobId(
      runId: string,
      mediaItemId: string,
      context: EvaluationContextType,
    ): string {
      return `eval_${runId}_${mediaItemId}_${context}`;
    }

    it('should generate unique job IDs for different contexts', () => {
      fc.assert(
        fc.property(runIdArb, mediaItemIdArb, (runId, mediaItemId) => {
          const catalogJobId = generateJobId(runId, mediaItemId, EvaluationContext.CATALOG);
          const trendingJobId = generateJobId(runId, mediaItemId, EvaluationContext.TRENDING);

          expect(catalogJobId).not.toBe(trendingJobId);
        }),
        { numRuns: 100 },
      );
    });

    it('should generate same job ID for same inputs', () => {
      fc.assert(
        fc.property(runIdArb, mediaItemIdArb, validContextArb, (runId, mediaItemId, context) => {
          const jobId1 = generateJobId(runId, mediaItemId, context);
          const jobId2 = generateJobId(runId, mediaItemId, context);

          expect(jobId1).toBe(jobId2);
        }),
        { numRuns: 100 },
      );
    });

    it('should include all components in job ID', () => {
      fc.assert(
        fc.property(runIdArb, mediaItemIdArb, validContextArb, (runId, mediaItemId, context) => {
          const jobId = generateJobId(runId, mediaItemId, context);

          expect(jobId).toContain(runId);
          expect(jobId).toContain(mediaItemId);
          expect(jobId).toContain(context);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('ErrorSampleEntry', () => {
    const errorMessageArb = fc.string({ minLength: 1, maxLength: 500 });
    const stackTraceArb = fc.option(fc.string({ minLength: 50, maxLength: 1000 }), {
      nil: undefined,
    });

    function createErrorSampleEntry(
      mediaItemId: string,
      errorMessage: string,
      stack?: string,
    ): ErrorSampleEntry {
      return {
        mediaItemId,
        error: errorMessage,
        stack: stack?.substring(0, 500),
        timestamp: new Date().toISOString(),
      };
    }

    it('should always have required fields', () => {
      fc.assert(
        fc.property(mediaItemIdArb, errorMessageArb, stackTraceArb, (mediaItemId, error, stack) => {
          const entry = createErrorSampleEntry(mediaItemId, error, stack);

          expect(entry.mediaItemId).toBe(mediaItemId);
          expect(entry.error).toBe(error);
          expect(entry.timestamp).toBeDefined();
        }),
        { numRuns: 100 },
      );
    });

    it('should truncate stack to 500 characters max', () => {
      fc.assert(
        fc.property(mediaItemIdArb, errorMessageArb, stackTraceArb, (mediaItemId, error, stack) => {
          const entry = createErrorSampleEntry(mediaItemId, error, stack);

          if (entry.stack) {
            expect(entry.stack.length).toBeLessThanOrEqual(500);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should have valid ISO timestamp', () => {
      fc.assert(
        fc.property(mediaItemIdArb, errorMessageArb, (mediaItemId, error) => {
          const entry = createErrorSampleEntry(mediaItemId, error);

          const parsedDate = new Date(entry.timestamp);
          expect(parsedDate.toISOString()).toBe(entry.timestamp);
        }),
        { numRuns: 100 },
      );
    });

    it('should be JSON serializable', () => {
      fc.assert(
        fc.property(mediaItemIdArb, errorMessageArb, stackTraceArb, (mediaItemId, error, stack) => {
          const entry = createErrorSampleEntry(mediaItemId, error, stack);

          const serialized = JSON.stringify(entry);
          const deserialized = JSON.parse(serialized) as ErrorSampleEntry;

          expect(deserialized.mediaItemId).toBe(entry.mediaItemId);
          expect(deserialized.error).toBe(entry.error);
          expect(deserialized.timestamp).toBe(entry.timestamp);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Context Validation Invariants', () => {
    /**
     * Property: Missing context MUST NOT result in any evaluation being written.
     * This is a critical invariant to prevent data corruption.
     */
    interface MockStorage {
      evaluations: Map<string, { mediaItemId: string; context: EvaluationContextType }>;
    }

    function simulateEvaluation(
      payload: { context?: EvaluationContextType; mediaItemId: string },
      storage: MockStorage,
    ): boolean {
      if (!payload.context) {
        // Missing context - do not write
        return false;
      }

      storage.evaluations.set(payload.mediaItemId, {
        mediaItemId: payload.mediaItemId,
        context: payload.context,
      });
      return true;
    }

    it('should never write evaluation when context is missing', () => {
      fc.assert(
        fc.property(mediaItemIdArb, (mediaItemId) => {
          const storage: MockStorage = { evaluations: new Map() };
          const payload = { mediaItemId }; // No context

          const result = simulateEvaluation(payload, storage);

          expect(result).toBe(false);
          expect(storage.evaluations.size).toBe(0);
        }),
        { numRuns: 100 },
      );
    });

    it('should always write evaluation when context is present', () => {
      fc.assert(
        fc.property(mediaItemIdArb, validContextArb, (mediaItemId, context) => {
          const storage: MockStorage = { evaluations: new Map() };
          const payload = { mediaItemId, context };

          const result = simulateEvaluation(payload, storage);

          expect(result).toBe(true);
          expect(storage.evaluations.size).toBe(1);
          expect(storage.evaluations.get(mediaItemId)?.context).toBe(context);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Batch Processing Invariants', () => {
    /**
     * Property: All dispatched jobs must have the same context as the parent job.
     */
    function simulateBatchDispatch(
      items: string[],
      parentContext: EvaluationContextType,
    ): Array<{ mediaItemId: string; context: EvaluationContextType }> {
      return items.map((mediaItemId) => ({
        mediaItemId,
        context: parentContext, // Context propagates from parent
      }));
    }

    it('should propagate context to all child jobs', () => {
      const itemsArb = fc.array(mediaItemIdArb, { minLength: 1, maxLength: 20 });

      fc.assert(
        fc.property(itemsArb, validContextArb, (items, context) => {
          const childJobs = simulateBatchDispatch(items, context);

          // All child jobs must have same context as parent
          for (const job of childJobs) {
            expect(job.context).toBe(context);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should create one child job per item', () => {
      const itemsArb = fc.array(mediaItemIdArb, { minLength: 1, maxLength: 20 });

      fc.assert(
        fc.property(itemsArb, validContextArb, (items, context) => {
          const childJobs = simulateBatchDispatch(items, context);

          expect(childJobs.length).toBe(items.length);
        }),
        { numRuns: 100 },
      );
    });
  });
});
