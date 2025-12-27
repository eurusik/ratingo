/**
 * Movie Listings Query Property-Based Tests
 *
 * Feature: context-aware-eligibility
 *
 * Property-based tests using fast-check to verify universal properties
 * that should hold across all valid inputs.
 */

import * as fc from 'fast-check';
import { EligibilityStatus } from '../../../catalog-policy/domain/constants/evaluation.constants';
import { EligibilityMode } from './movie-listings.query';

/**
 * Simulates the eligibility filtering logic from buildEligibilityCondition.
 * This is a pure function that mirrors the SQL condition logic for testing.
 */
function matchesEligibilityCondition(
  evaluation: { status: string; reasons: string[] },
  mode: EligibilityMode,
): boolean {
  if (mode === 'freshness') {
    // Freshness: eligible OR (ineligible with ONLY MISSING_GLOBAL_SIGNALS)
    return (
      evaluation.status === EligibilityStatus.ELIGIBLE ||
      (evaluation.status === EligibilityStatus.INELIGIBLE &&
        evaluation.reasons.length === 1 &&
        evaluation.reasons[0] === 'MISSING_GLOBAL_SIGNALS')
    );
  }

  // Catalog (default): only eligible
  return evaluation.status === EligibilityStatus.ELIGIBLE;
}

describe('Movie Listings Query - Property-Based Tests', () => {
  // Arbitraries for generating test data

  const eligibilityStatusArb = fc.constantFrom(
    EligibilityStatus.PENDING,
    EligibilityStatus.ELIGIBLE,
    EligibilityStatus.INELIGIBLE,
    EligibilityStatus.REVIEW,
  );

  const reasonArb = fc.constantFrom(
    'MISSING_GLOBAL_SIGNALS',
    'BLOCKED_COUNTRY',
    'BLOCKED_LANGUAGE',
    'NEUTRAL_COUNTRY',
    'NEUTRAL_LANGUAGE',
    'ALLOWED_COUNTRY',
    'ALLOWED_LANGUAGE',
    'BREAKOUT_ALLOWED',
    'MISSING_ORIGIN_COUNTRY',
    'MISSING_ORIGINAL_LANGUAGE',
  );

  const evaluationArb = fc.record({
    mediaItemId: fc.uuid(),
    status: eligibilityStatusArb,
    reasons: fc.array(reasonArb, { minLength: 0, maxLength: 5 }),
    relevanceScore: fc.nat({ max: 100 }),
    policyVersion: fc.nat({ max: 10 }),
  });

  /**
   * Property 3: Catalog Mode Returns Only Eligible
   * Feature: context-aware-eligibility, Property 3: Catalog Mode Returns Only Eligible
   * Validates: Requirements 3.2
   *
   * For any set of media_catalog_evaluations, querying with eligibilityMode: 'catalog'
   * SHALL return only items where status = 'eligible'.
   */
  describe('Property 3: Catalog Mode Returns Only Eligible', () => {
    it('should only match eligible items in catalog mode', () => {
      fc.assert(
        fc.property(evaluationArb, (evaluation) => {
          const matches = matchesEligibilityCondition(evaluation, 'catalog');

          if (evaluation.status === EligibilityStatus.ELIGIBLE) {
            // Eligible items MUST match
            expect(matches).toBe(true);
          } else {
            // Non-eligible items MUST NOT match
            expect(matches).toBe(false);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should never return pending items in catalog mode', () => {
      fc.assert(
        fc.property(
          fc.array(reasonArb, { minLength: 0, maxLength: 5 }),
          fc.nat({ max: 100 }),
          (reasons, relevanceScore) => {
            const evaluation = {
              status: EligibilityStatus.PENDING,
              reasons,
              relevanceScore,
            };

            const matches = matchesEligibilityCondition(evaluation, 'catalog');
            expect(matches).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should never return ineligible items in catalog mode', () => {
      fc.assert(
        fc.property(
          fc.array(reasonArb, { minLength: 0, maxLength: 5 }),
          fc.nat({ max: 100 }),
          (reasons, relevanceScore) => {
            const evaluation = {
              status: EligibilityStatus.INELIGIBLE,
              reasons,
              relevanceScore,
            };

            const matches = matchesEligibilityCondition(evaluation, 'catalog');
            expect(matches).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should never return review items in catalog mode', () => {
      fc.assert(
        fc.property(
          fc.array(reasonArb, { minLength: 0, maxLength: 5 }),
          fc.nat({ max: 100 }),
          (reasons, relevanceScore) => {
            const evaluation = {
              status: EligibilityStatus.REVIEW,
              reasons,
              relevanceScore,
            };

            const matches = matchesEligibilityCondition(evaluation, 'catalog');
            expect(matches).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return all eligible items regardless of reasons in catalog mode', () => {
      fc.assert(
        fc.property(
          fc.array(reasonArb, { minLength: 0, maxLength: 5 }),
          fc.nat({ max: 100 }),
          (reasons, relevanceScore) => {
            const evaluation = {
              status: EligibilityStatus.ELIGIBLE,
              reasons,
              relevanceScore,
            };

            const matches = matchesEligibilityCondition(evaluation, 'catalog');
            // Eligible items always match, regardless of reasons
            expect(matches).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should filter a mixed set of evaluations correctly in catalog mode', () => {
      fc.assert(
        fc.property(fc.array(evaluationArb, { minLength: 1, maxLength: 50 }), (evaluations) => {
          const filtered = evaluations.filter((e) => matchesEligibilityCondition(e, 'catalog'));

          // All filtered items must be eligible
          filtered.forEach((e) => {
            expect(e.status).toBe(EligibilityStatus.ELIGIBLE);
          });

          // Count of filtered items must equal count of eligible items
          const eligibleCount = evaluations.filter(
            (e) => e.status === EligibilityStatus.ELIGIBLE,
          ).length;
          expect(filtered.length).toBe(eligibleCount);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 4: Freshness Mode Whitelist Filter
   * Feature: context-aware-eligibility, Property 4: Freshness Mode Whitelist Filter
   * Validates: Requirements 3.3, 3.4, 6.2
   *
   * For any set of media_catalog_evaluations, querying with eligibilityMode: 'freshness' SHALL return:
   * - All items where status = 'eligible'
   * - Items where status = 'ineligible' AND reasons equals exactly ['MISSING_GLOBAL_SIGNALS']
   *
   * And SHALL NOT return:
   * - Items where status = 'pending'
   * - Items where status = 'ineligible' with any reasons containing BLOCKED_*, NEUTRAL_*, or any combination beyond just MISSING_GLOBAL_SIGNALS
   */
  describe('Property 4: Freshness Mode Whitelist Filter', () => {
    it('should always return eligible items in freshness mode', () => {
      fc.assert(
        fc.property(
          fc.array(reasonArb, { minLength: 0, maxLength: 5 }),
          fc.nat({ max: 100 }),
          (reasons, relevanceScore) => {
            const evaluation = {
              status: EligibilityStatus.ELIGIBLE,
              reasons,
              relevanceScore,
            };

            const matches = matchesEligibilityCondition(evaluation, 'freshness');
            // Eligible items MUST always match in freshness mode
            expect(matches).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return ineligible items with exactly MISSING_GLOBAL_SIGNALS reason in freshness mode', () => {
      fc.assert(
        fc.property(fc.nat({ max: 100 }), (relevanceScore) => {
          const evaluation = {
            status: EligibilityStatus.INELIGIBLE,
            reasons: ['MISSING_GLOBAL_SIGNALS'],
            relevanceScore,
          };

          const matches = matchesEligibilityCondition(evaluation, 'freshness');
          // Ineligible with exactly ['MISSING_GLOBAL_SIGNALS'] MUST match
          expect(matches).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('should never return pending items in freshness mode', () => {
      fc.assert(
        fc.property(
          fc.array(reasonArb, { minLength: 0, maxLength: 5 }),
          fc.nat({ max: 100 }),
          (reasons, relevanceScore) => {
            const evaluation = {
              status: EligibilityStatus.PENDING,
              reasons,
              relevanceScore,
            };

            const matches = matchesEligibilityCondition(evaluation, 'freshness');
            // Pending items MUST NOT match in freshness mode
            expect(matches).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should never return review items in freshness mode', () => {
      fc.assert(
        fc.property(
          fc.array(reasonArb, { minLength: 0, maxLength: 5 }),
          fc.nat({ max: 100 }),
          (reasons, relevanceScore) => {
            const evaluation = {
              status: EligibilityStatus.REVIEW,
              reasons,
              relevanceScore,
            };

            const matches = matchesEligibilityCondition(evaluation, 'freshness');
            // Review items MUST NOT match in freshness mode
            expect(matches).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should never return ineligible items with BLOCKED_COUNTRY in freshness mode', () => {
      fc.assert(
        fc.property(
          fc.array(reasonArb, { minLength: 0, maxLength: 4 }),
          fc.nat({ max: 100 }),
          (otherReasons, relevanceScore) => {
            const evaluation = {
              status: EligibilityStatus.INELIGIBLE,
              reasons: ['BLOCKED_COUNTRY', ...otherReasons],
              relevanceScore,
            };

            const matches = matchesEligibilityCondition(evaluation, 'freshness');
            // Hard blocked items MUST NOT match
            expect(matches).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should never return ineligible items with BLOCKED_LANGUAGE in freshness mode', () => {
      fc.assert(
        fc.property(
          fc.array(reasonArb, { minLength: 0, maxLength: 4 }),
          fc.nat({ max: 100 }),
          (otherReasons, relevanceScore) => {
            const evaluation = {
              status: EligibilityStatus.INELIGIBLE,
              reasons: ['BLOCKED_LANGUAGE', ...otherReasons],
              relevanceScore,
            };

            const matches = matchesEligibilityCondition(evaluation, 'freshness');
            // Hard blocked items MUST NOT match
            expect(matches).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should never return ineligible items with NEUTRAL_COUNTRY in freshness mode', () => {
      fc.assert(
        fc.property(
          fc.array(reasonArb, { minLength: 0, maxLength: 4 }),
          fc.nat({ max: 100 }),
          (otherReasons, relevanceScore) => {
            const evaluation = {
              status: EligibilityStatus.INELIGIBLE,
              reasons: ['NEUTRAL_COUNTRY', ...otherReasons],
              relevanceScore,
            };

            const matches = matchesEligibilityCondition(evaluation, 'freshness');
            // Neutral items MUST NOT match
            expect(matches).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should never return ineligible items with NEUTRAL_LANGUAGE in freshness mode', () => {
      fc.assert(
        fc.property(
          fc.array(reasonArb, { minLength: 0, maxLength: 4 }),
          fc.nat({ max: 100 }),
          (otherReasons, relevanceScore) => {
            const evaluation = {
              status: EligibilityStatus.INELIGIBLE,
              reasons: ['NEUTRAL_LANGUAGE', ...otherReasons],
              relevanceScore,
            };

            const matches = matchesEligibilityCondition(evaluation, 'freshness');
            // Neutral items MUST NOT match
            expect(matches).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should never return ineligible items with multiple reasons including MISSING_GLOBAL_SIGNALS in freshness mode', () => {
      // Generate at least one other reason besides MISSING_GLOBAL_SIGNALS
      const nonMissingGlobalSignalsReasonArb = fc.constantFrom(
        'BLOCKED_COUNTRY',
        'BLOCKED_LANGUAGE',
        'NEUTRAL_COUNTRY',
        'NEUTRAL_LANGUAGE',
        'ALLOWED_COUNTRY',
        'ALLOWED_LANGUAGE',
        'BREAKOUT_ALLOWED',
        'MISSING_ORIGIN_COUNTRY',
        'MISSING_ORIGINAL_LANGUAGE',
      );

      fc.assert(
        fc.property(
          fc.array(nonMissingGlobalSignalsReasonArb, { minLength: 1, maxLength: 4 }),
          fc.nat({ max: 100 }),
          (otherReasons, relevanceScore) => {
            const evaluation = {
              status: EligibilityStatus.INELIGIBLE,
              reasons: ['MISSING_GLOBAL_SIGNALS', ...otherReasons],
              relevanceScore,
            };

            const matches = matchesEligibilityCondition(evaluation, 'freshness');
            // Items with MISSING_GLOBAL_SIGNALS + other reasons MUST NOT match
            // Only exactly ['MISSING_GLOBAL_SIGNALS'] is allowed
            expect(matches).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should never return ineligible items with empty reasons array in freshness mode', () => {
      fc.assert(
        fc.property(fc.nat({ max: 100 }), (relevanceScore) => {
          const evaluation = {
            status: EligibilityStatus.INELIGIBLE,
            reasons: [],
            relevanceScore,
          };

          const matches = matchesEligibilityCondition(evaluation, 'freshness');
          // Empty reasons array MUST NOT match (whitelist requires exact match)
          expect(matches).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('should filter a mixed set of evaluations correctly in freshness mode', () => {
      fc.assert(
        fc.property(fc.array(evaluationArb, { minLength: 1, maxLength: 50 }), (evaluations) => {
          const filtered = evaluations.filter((e) => matchesEligibilityCondition(e, 'freshness'));

          // All filtered items must be either:
          // 1. Eligible, OR
          // 2. Ineligible with exactly ['MISSING_GLOBAL_SIGNALS']
          filtered.forEach((e) => {
            const isEligible = e.status === EligibilityStatus.ELIGIBLE;
            const isSoftBlockedOnly =
              e.status === EligibilityStatus.INELIGIBLE &&
              e.reasons.length === 1 &&
              e.reasons[0] === 'MISSING_GLOBAL_SIGNALS';

            expect(isEligible || isSoftBlockedOnly).toBe(true);
          });

          // Verify no pending or review items
          const hasPendingOrReview = filtered.some(
            (e) => e.status === EligibilityStatus.PENDING || e.status === EligibilityStatus.REVIEW,
          );
          expect(hasPendingOrReview).toBe(false);

          // Verify no hard blocked items
          const hasHardBlocked = filtered.some(
            (e) =>
              e.status === EligibilityStatus.INELIGIBLE &&
              (e.reasons.includes('BLOCKED_COUNTRY') || e.reasons.includes('BLOCKED_LANGUAGE')),
          );
          expect(hasHardBlocked).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it('should return superset of catalog mode results in freshness mode', () => {
      fc.assert(
        fc.property(fc.array(evaluationArb, { minLength: 1, maxLength: 50 }), (evaluations) => {
          const catalogFiltered = evaluations.filter((e) =>
            matchesEligibilityCondition(e, 'catalog'),
          );
          const freshnessFiltered = evaluations.filter((e) =>
            matchesEligibilityCondition(e, 'freshness'),
          );

          // Freshness mode should return at least as many items as catalog mode
          expect(freshnessFiltered.length).toBeGreaterThanOrEqual(catalogFiltered.length);

          // All catalog results should be in freshness results
          catalogFiltered.forEach((catalogItem) => {
            const inFreshness = freshnessFiltered.some(
              (f) => f.mediaItemId === catalogItem.mediaItemId,
            );
            expect(inFreshness).toBe(true);
          });
        }),
        { numRuns: 100 },
      );
    });
  });
});
