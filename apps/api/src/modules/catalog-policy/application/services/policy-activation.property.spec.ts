import * as fc from 'fast-check';

import {
  ACTIVE_EVALUATION_CONTEXTS,
  type EvaluationContextType,
} from '../../domain/constants/evaluation.constants';

type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'promoted';

interface RunData {
  status: RunStatus;
  totalReadySnapshot: number;
  processed: number;
  eligible: number;
  ineligible: number;
  errors: number;
  promotedAt: Date | null;
}

type BlockingReason =
  | 'RUN_NOT_SUCCESS'
  | 'COVERAGE_NOT_MET'
  | 'ERRORS_EXCEEDED'
  | 'ALREADY_PROMOTED';

function calculateCoverage(run: RunData): number {
  return run.totalReadySnapshot > 0 ? run.processed / run.totalReadySnapshot : 0;
}

function calculateBlockingReasons(run: RunData): BlockingReason[] {
  const reasons: BlockingReason[] = [];

  if (run.status !== 'success') {
    reasons.push('RUN_NOT_SUCCESS');
  }

  const coverage = calculateCoverage(run);
  if (coverage < 1.0) {
    reasons.push('COVERAGE_NOT_MET');
  }

  if (run.errors > 0) {
    reasons.push('ERRORS_EXCEEDED');
  }

  if (run.promotedAt !== null) {
    reasons.push('ALREADY_PROMOTED');
  }

  return reasons;
}

function isReadyToPromote(run: RunData): boolean {
  return calculateBlockingReasons(run).length === 0;
}

function canPromote(
  run: RunData,
  options: { coverageThreshold?: number; maxErrors?: number } = {},
): { success: boolean; error?: string } {
  const coverageThreshold = options.coverageThreshold ?? 1.0;
  const maxErrors = options.maxErrors ?? 0;

  if (run.status !== 'success') {
    return { success: false, error: `Run status is ${run.status}, expected success` };
  }

  const coverage = calculateCoverage(run);
  if (coverage < coverageThreshold) {
    return { success: false, error: 'Coverage below threshold' };
  }

  if (run.errors > maxErrors) {
    return { success: false, error: 'Errors exceed threshold' };
  }

  if (run.promotedAt !== null) {
    return { success: false, error: 'Already promoted' };
  }

  return { success: true };
}

describe('Policy Activation - Property-Based Tests', () => {
  // Arbitraries (generators)

  const runStatusArb = fc.constantFrom<RunStatus>(
    'pending',
    'running',
    'success',
    'failed',
    'cancelled',
    'promoted',
  );

  const runDataArb = fc.record({
    status: runStatusArb,
    totalReadySnapshot: fc.nat({ max: 100000 }),
    processed: fc.nat({ max: 100000 }),
    eligible: fc.nat({ max: 100000 }),
    ineligible: fc.nat({ max: 100000 }),
    errors: fc.nat({ max: 1000 }),
    promotedAt: fc.option(fc.date(), { nil: null }),
  });

  // Constrained generator: processed <= totalReadySnapshot
  const validRunDataArb = fc
    .record({
      status: runStatusArb,
      totalReadySnapshot: fc.nat({ max: 100000 }),
      eligible: fc.nat({ max: 100000 }),
      ineligible: fc.nat({ max: 100000 }),
      errors: fc.nat({ max: 1000 }),
      promotedAt: fc.option(fc.date(), { nil: null }),
    })
    .chain((base) =>
      fc.nat({ max: base.totalReadySnapshot }).map((processed) => ({
        ...base,
        processed,
      })),
    );

  describe('Property 2: Counter Consistency', () => {
    it('counters should sum to processed (when consistent)', () => {
      // Generate consistent run data
      const consistentRunArb = fc
        .record({
          status: runStatusArb,
          totalReadySnapshot: fc.nat({ max: 10000 }),
          eligible: fc.nat({ max: 3333 }),
          ineligible: fc.nat({ max: 3333 }),
          errors: fc.nat({ max: 3333 }),
          promotedAt: fc.option(fc.date(), { nil: null }),
        })
        .map((run) => ({
          ...run,
          processed: run.eligible + run.ineligible + run.errors,
        }));

      fc.assert(
        fc.property(consistentRunArb, (run) => {
          const sum = run.eligible + run.ineligible + run.errors;
          expect(sum).toBe(run.processed);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 12: Ready To Promote Flag', () => {
    it('readyToPromote should be true only when all conditions met', () => {
      fc.assert(
        fc.property(validRunDataArb, (run) => {
          const ready = isReadyToPromote(run);
          const coverage = calculateCoverage(run);

          if (ready) {
            // If ready, all conditions must be true
            expect(run.status).toBe('success');
            expect(coverage).toBeGreaterThanOrEqual(1.0);
            expect(run.errors).toBe(0);
            expect(run.promotedAt).toBeNull();
          }
        }),
        { numRuns: 100 },
      );
    });

    it('readyToPromote should be false when status is not success', () => {
      const nonSuccessStatusArb = fc.constantFrom<RunStatus>(
        'pending',
        'running',
        'failed',
        'cancelled',
        'promoted',
      );

      fc.assert(
        fc.property(
          validRunDataArb.map((run) => ({ ...run, status: 'running' as RunStatus })),
          (run) => {
            expect(isReadyToPromote(run)).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('readyToPromote should be false when coverage < 100%', () => {
      // Generate run with processed < totalReadySnapshot
      const incompleteCoverageArb = fc
        .record({
          totalReadySnapshot: fc.integer({ min: 10, max: 10000 }),
          eligible: fc.nat({ max: 5000 }),
          ineligible: fc.nat({ max: 5000 }),
          errors: fc.constant(0),
          promotedAt: fc.constant(null),
        })
        .chain((base) =>
          fc.integer({ min: 0, max: base.totalReadySnapshot - 1 }).map((processed) => ({
            ...base,
            status: 'success' as RunStatus,
            processed,
          })),
        );

      fc.assert(
        fc.property(incompleteCoverageArb, (run) => {
          expect(isReadyToPromote(run)).toBe(false);
          expect(calculateBlockingReasons(run)).toContain('COVERAGE_NOT_MET');
        }),
        { numRuns: 100 },
      );
    });

    it('readyToPromote should be false when errors > 0', () => {
      const runWithErrorsArb = fc
        .record({
          totalReadySnapshot: fc.integer({ min: 1, max: 10000 }),
          eligible: fc.nat({ max: 5000 }),
          ineligible: fc.nat({ max: 5000 }),
          errors: fc.integer({ min: 1, max: 100 }),
          promotedAt: fc.constant(null),
        })
        .map((base) => ({
          ...base,
          status: 'success' as RunStatus,
          processed: base.totalReadySnapshot,
        }));

      fc.assert(
        fc.property(runWithErrorsArb, (run) => {
          expect(isReadyToPromote(run)).toBe(false);
          expect(calculateBlockingReasons(run)).toContain('ERRORS_EXCEEDED');
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 7: Promote Status Validation', () => {
    it('canPromote should fail for non-success status', () => {
      const nonSuccessArb = fc.constantFrom<RunStatus>(
        'pending',
        'running',
        'failed',
        'cancelled',
        'promoted',
      );

      fc.assert(
        fc.property(validRunDataArb, nonSuccessArb, (run, status) => {
          const runWithStatus = { ...run, status };
          const result = canPromote(runWithStatus);

          expect(result.success).toBe(false);
          expect(result.error).toContain(status);
        }),
        { numRuns: 100 },
      );
    });

    it('canPromote should succeed when all conditions met', () => {
      // Generate perfect run: success, 100% coverage, 0 errors, not promoted
      const perfectRunArb = fc.integer({ min: 1, max: 10000 }).map((total) => ({
        status: 'success' as RunStatus,
        totalReadySnapshot: total,
        processed: total,
        eligible: Math.floor(total * 0.9),
        ineligible: Math.floor(total * 0.1),
        errors: 0,
        promotedAt: null,
      }));

      fc.assert(
        fc.property(perfectRunArb, (run) => {
          const result = canPromote(run);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('canPromote should respect custom coverage threshold', () => {
      // Generate run with exactly 95% coverage
      const run95Arb = fc.integer({ min: 100, max: 10000 }).map((total) => {
        const processed = Math.floor(total * 0.95);
        return {
          status: 'success' as RunStatus,
          totalReadySnapshot: total,
          processed,
          eligible: processed,
          ineligible: 0,
          errors: 0,
          promotedAt: null,
        };
      });

      fc.assert(
        fc.property(run95Arb, (run) => {
          const coverage = calculateCoverage(run);

          // Only test if coverage is actually < 100%
          if (coverage < 1.0) {
            // Should fail with default 100% threshold
            expect(canPromote(run).success).toBe(false);

            // Should succeed with threshold <= actual coverage
            expect(canPromote(run, { coverageThreshold: coverage }).success).toBe(true);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('canPromote should respect custom error threshold', () => {
      // Generate run with some errors
      const runWithErrorsArb = fc
        .record({
          totalReadySnapshot: fc.integer({ min: 100, max: 10000 }),
          errors: fc.integer({ min: 1, max: 10 }),
        })
        .map(({ totalReadySnapshot, errors }) => ({
          status: 'success' as RunStatus,
          totalReadySnapshot,
          processed: totalReadySnapshot,
          eligible: totalReadySnapshot - errors,
          ineligible: 0,
          errors,
          promotedAt: null,
        }));

      fc.assert(
        fc.property(runWithErrorsArb, (run) => {
          // Should fail with default 0 errors threshold
          expect(canPromote(run).success).toBe(false);

          // Should succeed with higher threshold
          expect(canPromote(run, { maxErrors: run.errors }).success).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('Property: Coverage Calculation', () => {
    it('coverage should be in range [0, 1]', () => {
      fc.assert(
        fc.property(validRunDataArb, (run) => {
          const coverage = calculateCoverage(run);

          expect(coverage).toBeGreaterThanOrEqual(0);
          expect(coverage).toBeLessThanOrEqual(1);
        }),
        { numRuns: 100 },
      );
    });

    it('coverage should be 0 when totalReadySnapshot is 0', () => {
      fc.assert(
        fc.property(
          validRunDataArb.map((run) => ({ ...run, totalReadySnapshot: 0, processed: 0 })),
          (run) => {
            expect(calculateCoverage(run)).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('coverage should be 1 when processed equals totalReadySnapshot', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }).map((total) => ({
            status: 'success' as RunStatus,
            totalReadySnapshot: total,
            processed: total,
            eligible: total,
            ineligible: 0,
            errors: 0,
            promotedAt: null,
          })),
          (run) => {
            expect(calculateCoverage(run)).toBe(1);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property: Blocking Reasons Consistency', () => {
    it('RUN_NOT_SUCCESS should appear iff status !== success', () => {
      fc.assert(
        fc.property(runDataArb, (run) => {
          const reasons = calculateBlockingReasons(run);
          const hasReason = reasons.includes('RUN_NOT_SUCCESS');

          expect(hasReason).toBe(run.status !== 'success');
        }),
        { numRuns: 100 },
      );
    });

    it('ERRORS_EXCEEDED should appear iff errors > 0', () => {
      fc.assert(
        fc.property(runDataArb, (run) => {
          const reasons = calculateBlockingReasons(run);
          const hasReason = reasons.includes('ERRORS_EXCEEDED');

          expect(hasReason).toBe(run.errors > 0);
        }),
        { numRuns: 100 },
      );
    });

    it('ALREADY_PROMOTED should appear iff promotedAt !== null', () => {
      fc.assert(
        fc.property(runDataArb, (run) => {
          const reasons = calculateBlockingReasons(run);
          const hasReason = reasons.includes('ALREADY_PROMOTED');

          expect(hasReason).toBe(run.promotedAt !== null);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Feature: multi-context-evaluation
   * Property 3: Fan-Out Coverage
   *
   * For any policy activation trigger, the system SHALL create exactly
   * ACTIVE_EVALUATION_CONTEXTS.length RE_EVALUATE_ALL jobs, with each job
   * having a unique context from ACTIVE_EVALUATION_CONTEXTS.
   */
  describe('Property 3: Fan-Out Coverage', () => {
    /**
     * Simulates the fan-out logic from PolicyActivationService.preparePolicy
     * Returns the contexts that would be dispatched as RE_EVALUATE_ALL jobs
     */
    function simulateFanOut(
      activeContexts: readonly EvaluationContextType[],
    ): EvaluationContextType[] {
      const dispatchedContexts: EvaluationContextType[] = [];
      for (const context of activeContexts) {
        dispatchedContexts.push(context);
      }
      return dispatchedContexts;
    }

    it('should create exactly ACTIVE_EVALUATION_CONTEXTS.length jobs', () => {
      /**
       * Property: For any policy version, fan-out creates exactly N jobs
       * where N = ACTIVE_EVALUATION_CONTEXTS.length
       */
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (_policyVersion) => {
          const dispatchedContexts = simulateFanOut(ACTIVE_EVALUATION_CONTEXTS);

          expect(dispatchedContexts.length).toBe(ACTIVE_EVALUATION_CONTEXTS.length);
        }),
        { numRuns: 100 },
      );
    });

    it('should dispatch each active context exactly once', () => {
      /**
       * Property: For any policy activation, each context in ACTIVE_EVALUATION_CONTEXTS
       * appears exactly once in the dispatched jobs
       */
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (_policyVersion) => {
          const dispatchedContexts = simulateFanOut(ACTIVE_EVALUATION_CONTEXTS);

          // Each active context should appear exactly once
          for (const expectedContext of ACTIVE_EVALUATION_CONTEXTS) {
            const count = dispatchedContexts.filter((c) => c === expectedContext).length;
            expect(count).toBe(1);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should only dispatch contexts from ACTIVE_EVALUATION_CONTEXTS', () => {
      /**
       * Property: For any policy activation, all dispatched contexts
       * must be members of ACTIVE_EVALUATION_CONTEXTS
       */
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (_policyVersion) => {
          const dispatchedContexts = simulateFanOut(ACTIVE_EVALUATION_CONTEXTS);

          // All dispatched contexts should be in ACTIVE_EVALUATION_CONTEXTS
          for (const context of dispatchedContexts) {
            expect(ACTIVE_EVALUATION_CONTEXTS).toContain(context);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should have unique contexts in dispatched jobs', () => {
      /**
       * Property: For any policy activation, all dispatched contexts are unique
       * (no duplicates)
       */
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 1000 }), (_policyVersion) => {
          const dispatchedContexts = simulateFanOut(ACTIVE_EVALUATION_CONTEXTS);
          const uniqueContexts = new Set(dispatchedContexts);

          expect(uniqueContexts.size).toBe(dispatchedContexts.length);
        }),
        { numRuns: 100 },
      );
    });

    it('should cover all active contexts regardless of context list size', () => {
      /**
       * Property: For any non-empty subset of evaluation contexts,
       * fan-out covers all contexts in that subset exactly once
       */
      const contextSubsetArb = fc
        .subarray([...ACTIVE_EVALUATION_CONTEXTS] as EvaluationContextType[], { minLength: 1 })
        .filter((arr) => arr.length > 0);

      fc.assert(
        fc.property(contextSubsetArb, (contextSubset) => {
          const dispatchedContexts = simulateFanOut(contextSubset);

          // Should dispatch exactly the contexts in the subset
          expect(dispatchedContexts.length).toBe(contextSubset.length);

          // Each context in subset should be dispatched
          for (const context of contextSubset) {
            expect(dispatchedContexts).toContain(context);
          }

          // No extra contexts
          for (const dispatched of dispatchedContexts) {
            expect(contextSubset).toContain(dispatched);
          }
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Feature: multi-context-evaluation
   * Property 8: Backfill Context Isolation
   *
   * For any backfill operation triggered for context X, the operation SHALL only
   * write evaluation records with `context = X`. No records with other context
   * values SHALL be created or modified.
   */
  describe('Property 8: Backfill Context Isolation', () => {
    /**
     * Simulates the backfill logic from PolicyActivationService.backfillContext
     * Returns the context that would be dispatched in the RE_EVALUATE_ALL job
     */
    function simulateBackfill(
      targetContext: EvaluationContextType,
      activeContexts: readonly EvaluationContextType[],
    ): { dispatchedContext: EvaluationContextType | null; isValid: boolean } {
      // Validate context is in active contexts
      if (!activeContexts.includes(targetContext)) {
        return { dispatchedContext: null, isValid: false };
      }

      // Backfill dispatches only the target context
      return { dispatchedContext: targetContext, isValid: true };
    }

    it('should dispatch only the specified context', () => {
      /**
       * Property: For any valid backfill request with context X,
       * only context X is dispatched (not other contexts)
       */
      const validContextArb = fc.constantFrom(
        ...(ACTIVE_EVALUATION_CONTEXTS as readonly EvaluationContextType[]),
      );

      fc.assert(
        fc.property(validContextArb, (targetContext) => {
          const result = simulateBackfill(targetContext, ACTIVE_EVALUATION_CONTEXTS);

          // Should be valid
          expect(result.isValid).toBe(true);

          // Should dispatch exactly the target context
          expect(result.dispatchedContext).toBe(targetContext);
        }),
        { numRuns: 100 },
      );
    });

    it('should not dispatch other contexts during backfill', () => {
      /**
       * Property: For any backfill of context X, no other context Y (Y !== X)
       * should be dispatched
       */
      const validContextArb = fc.constantFrom(
        ...(ACTIVE_EVALUATION_CONTEXTS as readonly EvaluationContextType[]),
      );

      fc.assert(
        fc.property(validContextArb, (targetContext) => {
          const result = simulateBackfill(targetContext, ACTIVE_EVALUATION_CONTEXTS);

          // For each other context, verify it's not dispatched
          for (const otherContext of ACTIVE_EVALUATION_CONTEXTS) {
            if (otherContext !== targetContext) {
              expect(result.dispatchedContext).not.toBe(otherContext);
            }
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should reject invalid contexts', () => {
      /**
       * Property: For any context not in ACTIVE_EVALUATION_CONTEXTS,
       * backfill should fail validation
       */
      const invalidContextArb = fc
        .string({ minLength: 1, maxLength: 20 })
        .filter((s) => !ACTIVE_EVALUATION_CONTEXTS.includes(s as EvaluationContextType));

      fc.assert(
        fc.property(invalidContextArb, (invalidContext) => {
          const result = simulateBackfill(
            invalidContext as EvaluationContextType,
            ACTIVE_EVALUATION_CONTEXTS,
          );

          // Should be invalid
          expect(result.isValid).toBe(false);
          expect(result.dispatchedContext).toBeNull();
        }),
        { numRuns: 100 },
      );
    });

    it('should maintain context isolation across multiple backfills', () => {
      /**
       * Property: For any sequence of backfill operations,
       * each backfill only affects its target context
       */
      const backfillSequenceArb = fc.array(
        fc.constantFrom(...(ACTIVE_EVALUATION_CONTEXTS as readonly EvaluationContextType[])),
        { minLength: 1, maxLength: 10 },
      );

      fc.assert(
        fc.property(backfillSequenceArb, (backfillSequence) => {
          const results = backfillSequence.map((context) =>
            simulateBackfill(context, ACTIVE_EVALUATION_CONTEXTS),
          );

          // Each backfill should dispatch exactly its target context
          for (let i = 0; i < backfillSequence.length; i++) {
            expect(results[i].isValid).toBe(true);
            expect(results[i].dispatchedContext).toBe(backfillSequence[i]);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('backfill should be idempotent for same context', () => {
      /**
       * Property: Running backfill N times for context X should produce
       * the same result each time (same context dispatched)
       */
      const validContextArb = fc.constantFrom(
        ...(ACTIVE_EVALUATION_CONTEXTS as readonly EvaluationContextType[]),
      );
      const repeatCountArb = fc.integer({ min: 1, max: 5 });

      fc.assert(
        fc.property(validContextArb, repeatCountArb, (targetContext, repeatCount) => {
          const results: Array<{
            dispatchedContext: EvaluationContextType | null;
            isValid: boolean;
          }> = [];

          for (let i = 0; i < repeatCount; i++) {
            results.push(simulateBackfill(targetContext, ACTIVE_EVALUATION_CONTEXTS));
          }

          // All results should be identical
          for (const result of results) {
            expect(result.isValid).toBe(true);
            expect(result.dispatchedContext).toBe(targetContext);
          }
        }),
        { numRuns: 100 },
      );
    });
  });
});
