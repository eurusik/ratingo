/**
 * Diff Service Property-Based Tests
 *
 * Property-based tests using fast-check to verify universal properties
 * that should hold across all valid inputs.
 *
 * Feature: catalog-policy-refactoring
 */

import * as fc from 'fast-check';
import { isDiffRegression, isDiffImprovement, DiffSample } from './diff.service';
import {
  EligibilityStatus,
  DIFF_STATUS_NONE,
  DiffStatus,
} from '../../domain/constants/evaluation.constants';

/**
 * Pure function to filter and limit samples (mirrors getSampleItems logic).
 * This is extracted for property testing without database dependencies.
 */
function filterAndLimitSamples(
  samples: DiffSample[],
  type: 'regression' | 'improvement',
  limit: number,
): DiffSample[] {
  const filtered = samples.filter((sample) => {
    const oldStatus = sample.oldStatus as DiffStatus;
    const newStatus = sample.newStatus as DiffStatus;

    if (type === 'regression') {
      return isDiffRegression(oldStatus, newStatus);
    } else {
      return isDiffImprovement(oldStatus, newStatus);
    }
  });

  // Sort by trendingScore DESC and limit
  return filtered.sort((a, b) => (b.trendingScore ?? 0) - (a.trendingScore ?? 0)).slice(0, limit);
}

describe('DiffService - Property-Based Tests', () => {
  // Arbitraries (generators)

  const eligibilityStatusArb = fc.constantFrom<DiffStatus>(
    EligibilityStatus.PENDING,
    EligibilityStatus.ELIGIBLE,
    EligibilityStatus.INELIGIBLE,
    EligibilityStatus.REVIEW,
  );

  const diffStatusArb = fc.constantFrom<DiffStatus>(
    EligibilityStatus.PENDING,
    EligibilityStatus.ELIGIBLE,
    EligibilityStatus.INELIGIBLE,
    EligibilityStatus.REVIEW,
    DIFF_STATUS_NONE,
  );

  const diffSampleArb = fc.record({
    mediaItemId: fc.uuid(),
    title: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: null }),
    oldStatus: diffStatusArb.map((s) => s as string),
    newStatus: diffStatusArb.map((s) => s as string),
    trendingScore: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: null }),
  });

  const diffSampleArrayArb = fc.array(diffSampleArb, { minLength: 0, maxLength: 200 });

  /**
   * Property 2: DiffService Sample Respects Limit
   *
   * For any valid runId and sampleSize parameter, the getSampleItems() function
   * SHALL return at most sampleSize items.
   *
   * **Validates: Requirements 3.2**
   */
  describe('Property 2: DiffService Sample Respects Limit', () => {
    it('should never return more items than the specified limit', () => {
      fc.assert(
        fc.property(
          diffSampleArrayArb,
          fc.constantFrom<'regression' | 'improvement'>('regression', 'improvement'),
          fc.integer({ min: 1, max: 100 }),
          (samples, type, limit) => {
            const result = filterAndLimitSamples(samples, type, limit);

            // Property: result length should never exceed limit
            expect(result.length).toBeLessThanOrEqual(limit);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return exactly limit items when more are available', () => {
      // Generate samples that will definitely have enough regressions
      const manyRegressionsArb = fc.integer({ min: 10, max: 100 }).chain((count) =>
        fc.array(
          fc.record({
            mediaItemId: fc.uuid(),
            title: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
            oldStatus: fc.constant(EligibilityStatus.ELIGIBLE as string),
            newStatus: fc.constant(EligibilityStatus.INELIGIBLE as string),
            trendingScore: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: null }),
          }),
          { minLength: count, maxLength: count },
        ),
      );

      fc.assert(
        fc.property(manyRegressionsArb, fc.integer({ min: 1, max: 50 }), (samples, limit) => {
          const result = filterAndLimitSamples(samples, 'regression', limit);

          // When we have more samples than limit, result should be exactly limit
          if (samples.length >= limit) {
            expect(result.length).toBe(limit);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should return all items when fewer than limit are available', () => {
      fc.assert(
        fc.property(
          diffSampleArrayArb,
          fc.constantFrom<'regression' | 'improvement'>('regression', 'improvement'),
          fc.integer({ min: 100, max: 500 }), // Large limit
          (samples, type, limit) => {
            const result = filterAndLimitSamples(samples, type, limit);

            // Count how many samples match the type
            const matchingCount = samples.filter((s) => {
              const oldStatus = s.oldStatus as DiffStatus;
              const newStatus = s.newStatus as DiffStatus;
              return type === 'regression'
                ? isDiffRegression(oldStatus, newStatus)
                : isDiffImprovement(oldStatus, newStatus);
            }).length;

            // When we have fewer matching samples than limit, return all matching
            if (matchingCount < limit) {
              expect(result.length).toBe(matchingCount);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return empty array when limit is 0', () => {
      fc.assert(
        fc.property(
          diffSampleArrayArb,
          fc.constantFrom<'regression' | 'improvement'>('regression', 'improvement'),
          (samples, type) => {
            const result = filterAndLimitSamples(samples, type, 0);

            expect(result.length).toBe(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should preserve ordering by trendingScore DESC', () => {
      fc.assert(
        fc.property(
          diffSampleArrayArb,
          fc.constantFrom<'regression' | 'improvement'>('regression', 'improvement'),
          fc.integer({ min: 1, max: 100 }),
          (samples, type, limit) => {
            const result = filterAndLimitSamples(samples, type, limit);

            // Verify ordering: each item should have trendingScore >= next item
            for (let i = 0; i < result.length - 1; i++) {
              const current = result[i].trendingScore ?? 0;
              const next = result[i + 1].trendingScore ?? 0;
              expect(current).toBeGreaterThanOrEqual(next);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property: Helper Functions Consistency
   *
   * isDiffRegression and isDiffImprovement should be mutually exclusive
   * for any given status transition.
   */
  describe('Property: Helper Functions Consistency', () => {
    it('regression and improvement should be mutually exclusive', () => {
      fc.assert(
        fc.property(diffStatusArb, diffStatusArb, (oldStatus, newStatus) => {
          const isRegression = isDiffRegression(oldStatus, newStatus);
          const isImprovement = isDiffImprovement(oldStatus, newStatus);

          // Cannot be both regression and improvement
          expect(isRegression && isImprovement).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('eligible to eligible should be neither regression nor improvement', () => {
      const result = {
        isRegression: isDiffRegression(EligibilityStatus.ELIGIBLE, EligibilityStatus.ELIGIBLE),
        isImprovement: isDiffImprovement(EligibilityStatus.ELIGIBLE, EligibilityStatus.ELIGIBLE),
      };

      expect(result.isRegression).toBe(false);
      expect(result.isImprovement).toBe(false);
    });

    it('ineligible to ineligible should be neither regression nor improvement', () => {
      const result = {
        isRegression: isDiffRegression(EligibilityStatus.INELIGIBLE, EligibilityStatus.INELIGIBLE),
        isImprovement: isDiffImprovement(
          EligibilityStatus.INELIGIBLE,
          EligibilityStatus.INELIGIBLE,
        ),
      };

      expect(result.isRegression).toBe(false);
      expect(result.isImprovement).toBe(false);
    });
  });

  /**
   * Property: Regression Definition
   *
   * A regression occurs when an item was ELIGIBLE and becomes non-ELIGIBLE.
   */
  describe('Property: Regression Definition', () => {
    it('regression requires old status to be ELIGIBLE', () => {
      const nonEligibleArb = fc.constantFrom<DiffStatus>(
        EligibilityStatus.PENDING,
        EligibilityStatus.INELIGIBLE,
        EligibilityStatus.REVIEW,
        DIFF_STATUS_NONE,
      );

      fc.assert(
        fc.property(nonEligibleArb, diffStatusArb, (oldStatus, newStatus) => {
          // If old status is not ELIGIBLE, it cannot be a regression
          expect(isDiffRegression(oldStatus, newStatus)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('regression requires new status to be non-ELIGIBLE', () => {
      fc.assert(
        fc.property(diffStatusArb, (oldStatus) => {
          // If new status is ELIGIBLE, it cannot be a regression
          expect(isDiffRegression(oldStatus, EligibilityStatus.ELIGIBLE)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property: Improvement Definition
   *
   * An improvement occurs when an item was non-ELIGIBLE and becomes ELIGIBLE.
   */
  describe('Property: Improvement Definition', () => {
    it('improvement requires new status to be ELIGIBLE', () => {
      const nonEligibleArb = fc.constantFrom<DiffStatus>(
        EligibilityStatus.PENDING,
        EligibilityStatus.INELIGIBLE,
        EligibilityStatus.REVIEW,
        DIFF_STATUS_NONE,
      );

      fc.assert(
        fc.property(diffStatusArb, nonEligibleArb, (oldStatus, newStatus) => {
          // If new status is not ELIGIBLE, it cannot be an improvement
          expect(isDiffImprovement(oldStatus, newStatus)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('improvement requires old status to be non-ELIGIBLE', () => {
      fc.assert(
        fc.property(diffStatusArb, (newStatus) => {
          // If old status is ELIGIBLE, it cannot be an improvement
          expect(isDiffImprovement(EligibilityStatus.ELIGIBLE, newStatus)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });
  });
});
