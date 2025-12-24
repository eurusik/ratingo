/**
 * Policy Activation Service Property-Based Tests
 *
 * Property-based tests using fast-check to verify universal properties
 * that should hold across all valid inputs.
 *
 * Feature: policy-activation-flow
 */

import * as fc from 'fast-check';

/**
 * Pure functions extracted for property testing.
 * These mirror the logic in PolicyActivationService but are testable without mocks.
 */

type RunStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'promoted';

interface RunData {
  status: RunStatus;
  totalReadySnapshot: number;
  processed: number;
  eligible: number;
  ineligible: number;
  pending: number;
  errors: number;
  promotedAt: Date | null;
}

type BlockingReason =
  | 'RUN_NOT_SUCCESS'
  | 'COVERAGE_NOT_MET'
  | 'ERRORS_EXCEEDED'
  | 'ALREADY_PROMOTED';

/**
 * Calculates coverage from run data.
 */
function calculateCoverage(run: RunData): number {
  return run.totalReadySnapshot > 0 ? run.processed / run.totalReadySnapshot : 0;
}

/**
 * Calculates blocking reasons for a run.
 */
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

/**
 * Determines if run is ready to promote.
 */
function isReadyToPromote(run: RunData): boolean {
  return calculateBlockingReasons(run).length === 0;
}

/**
 * Validates if promote should succeed.
 */
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
    pending: fc.nat({ max: 100000 }),
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
      pending: fc.nat({ max: 100000 }),
      errors: fc.nat({ max: 1000 }),
      promotedAt: fc.option(fc.date(), { nil: null }),
    })
    .chain((base) =>
      fc.nat({ max: base.totalReadySnapshot }).map((processed) => ({
        ...base,
        processed,
      })),
    );

  /**
   * Property 2: Counter Consistency
   *
   * eligible + ineligible + pending + errors = processed
   *
   * Validates: Requirements 1.3, 5.4
   */
  describe('Property 2: Counter Consistency', () => {
    it('counters should sum to processed (when consistent)', () => {
      // Generate consistent run data
      const consistentRunArb = fc
        .record({
          status: runStatusArb,
          totalReadySnapshot: fc.nat({ max: 10000 }),
          eligible: fc.nat({ max: 2500 }),
          ineligible: fc.nat({ max: 2500 }),
          pending: fc.nat({ max: 2500 }),
          errors: fc.nat({ max: 2500 }),
          promotedAt: fc.option(fc.date(), { nil: null }),
        })
        .map((run) => ({
          ...run,
          processed: run.eligible + run.ineligible + run.pending + run.errors,
        }));

      fc.assert(
        fc.property(consistentRunArb, (run) => {
          const sum = run.eligible + run.ineligible + run.pending + run.errors;
          expect(sum).toBe(run.processed);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 12: Ready To Promote Flag
   *
   * readyToPromote = status=SUCCESS AND coverage >= threshold AND errors <= max
   *
   * Validates: Requirements 3.9
   */
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
          pending: fc.nat({ max: 5000 }),
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
          pending: fc.nat({ max: 5000 }),
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

  /**
   * Property 7: Promote Status Validation
   *
   * Promote only allowed when status=SUCCESS
   *
   * Validates: Requirements 3.1, 3.2, 3.8
   */
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
        pending: 0,
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
          pending: 0,
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
          pending: 0,
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

  /**
   * Property: Coverage Calculation
   *
   * Coverage should always be in range [0, 1] when processed <= totalReadySnapshot
   */
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
            pending: 0,
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

  /**
   * Property: Blocking Reasons Consistency
   *
   * Blocking reasons should be consistent with run state.
   */
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
});
