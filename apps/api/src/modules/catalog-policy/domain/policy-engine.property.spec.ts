/**
 * Policy Engine Property-Based Tests
 *
 * Feature: catalog-policy-engine
 */

import * as fc from 'fast-check';
import { evaluateEligibility, computeRelevance } from './policy-engine';
import { PolicyConfig, PolicyEngineInput } from './types/policy.types';
import { EligibilityStatus, EligibilityStatusType } from './constants/evaluation.constants';

describe('Policy Engine - Property-Based Tests', () => {
  // Arbitraries (generators) for property-based testing

  const countryCodeArb = fc.stringMatching(/^[A-Z]{2}$/);
  const languageCodeArb = fc.stringMatching(/^[a-z]{2}$/);

  const breakoutRuleArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 20 }),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    priority: fc.nat({ max: 100 }),
    requirements: fc.record({
      minImdbVotes: fc.option(fc.nat({ max: 1000000 })),
      minTraktVotes: fc.option(fc.nat({ max: 100000 })),
      minQualityScoreNormalized: fc.option(fc.double({ min: 0, max: 1 })),
      requireAnyOfProviders: fc.option(fc.array(fc.string(), { maxLength: 5 })),
      requireAnyOfRatingsPresent: fc.option(
        fc.array(fc.constantFrom('imdb', 'metacritic', 'rt', 'trakt'), { maxLength: 4 }),
      ),
    }),
  });

  const policyConfigArb = fc.record({
    allowedCountries: fc.array(countryCodeArb, { minLength: 1, maxLength: 20 }),
    blockedCountries: fc.array(countryCodeArb, { maxLength: 10 }),
    blockedCountryMode: fc.constantFrom('ANY', 'MAJORITY'),
    allowedLanguages: fc.array(languageCodeArb, { minLength: 1, maxLength: 10 }),
    blockedLanguages: fc.array(languageCodeArb, { maxLength: 5 }),
    globalProviders: fc.array(fc.string(), { maxLength: 10 }),
    breakoutRules: fc.array(breakoutRuleArb, { maxLength: 5 }),
    eligibilityMode: fc.constantFrom('STRICT', 'RELAXED'),
    homepage: fc.record({
      minRelevanceScore: fc.nat({ max: 100 }),
    }),
  });

  const mediaItemArb = fc.record({
    id: fc.uuid(),
    originCountries: fc.option(fc.array(countryCodeArb, { minLength: 1, maxLength: 5 })),
    originalLanguage: fc.option(languageCodeArb),
    watchProviders: fc.constant(null), // Simplified for now
    voteCountImdb: fc.option(fc.nat({ max: 1000000 })),
    voteCountTrakt: fc.option(fc.nat({ max: 100000 })),
    ratingImdb: fc.option(fc.double({ min: 0, max: 10 })),
    ratingMetacritic: fc.option(fc.nat({ max: 100 })),
    ratingRottenTomatoes: fc.option(fc.nat({ max: 100 })),
    ratingTrakt: fc.option(fc.double({ min: 0, max: 10 })),
  });

  const statsArb = fc.option(
    fc.record({
      qualityScore: fc.option(fc.double({ min: 0, max: 1 })),
      popularityScore: fc.option(fc.double({ min: 0, max: 1 })),
      freshnessScore: fc.option(fc.double({ min: 0, max: 1 })),
      ratingoScore: fc.option(fc.double({ min: 0, max: 1 })),
    }),
  );

  const policyEngineInputArb = fc.record({
    mediaItem: mediaItemArb,
    stats: statsArb,
  });

  /**
   * Property 1: Canonical Lowercase Status
   * Validates: Requirements 1.2, 1.3
   */
  describe('Property: Canonical Lowercase Status', () => {
    // Canonical lowercase status values
    const CANONICAL_STATUSES: EligibilityStatusType[] = [
      EligibilityStatus.PENDING,
      EligibilityStatus.ELIGIBLE,
      EligibilityStatus.INELIGIBLE,
      EligibilityStatus.REVIEW,
    ];

    it('should always return a canonical lowercase status value', () => {
      fc.assert(
        fc.property(policyEngineInputArb, policyConfigArb, (input, policy) => {
          const result = evaluateEligibility(input, policy);

          // Status must be one of the canonical lowercase values
          expect(CANONICAL_STATUSES).toContain(result.status);

          // Status must be lowercase (no uppercase characters)
          expect(result.status).toBe(result.status.toLowerCase());

          // Status must be a string
          expect(typeof result.status).toBe('string');
        }),
        { numRuns: 100 },
      );
    });

    it('should never return uppercase status values', () => {
      fc.assert(
        fc.property(policyEngineInputArb, policyConfigArb, (input, policy) => {
          const result = evaluateEligibility(input, policy);

          // Explicitly check that uppercase variants are NOT returned
          const UPPERCASE_STATUSES = ['PENDING', 'ELIGIBLE', 'INELIGIBLE', 'REVIEW'];
          expect(UPPERCASE_STATUSES).not.toContain(result.status);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property: Evaluation Determinism
   * Validates: Requirements 3.1, 3.5
   */
  describe('Property 1: Evaluation Determinism', () => {
    it('should produce identical results for identical inputs', () => {
      fc.assert(
        fc.property(policyEngineInputArb, policyConfigArb, (input, policy) => {
          const result1 = evaluateEligibility(input, policy);
          const result2 = evaluateEligibility(input, policy);

          // Results should be deeply equal
          expect(result1.status).toBe(result2.status);
          expect(result1.reasons).toEqual(result2.reasons);
          expect(result1.breakoutRuleId).toBe(result2.breakoutRuleId);
        }),
        { numRuns: 100 },
      );
    });

    it('should produce identical results when called in different order', () => {
      fc.assert(
        fc.property(
          policyEngineInputArb,
          policyEngineInputArb,
          policyConfigArb,
          (input1, input2, policy) => {
            // Evaluate in order: input1, input2, input1 again
            const result1a = evaluateEligibility(input1, policy);
            const result2 = evaluateEligibility(input2, policy);
            const result1b = evaluateEligibility(input1, policy);

            // First and third evaluations of input1 should be identical
            expect(result1a.status).toBe(result1b.status);
            expect(result1a.reasons).toEqual(result1b.reasons);
            expect(result1a.breakoutRuleId).toBe(result1b.breakoutRuleId);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property: Breakout Rule Priority Ordering
   * Validates: Requirements 4.6
   */
  describe('Property 6: Breakout Rule Priority Ordering', () => {
    it('should always select the breakout rule with lowest priority number', () => {
      fc.assert(
        fc.property(
          policyEngineInputArb,
          fc.array(breakoutRuleArb, { minLength: 2, maxLength: 5 }),
          (input, rules) => {
            // Ensure unique IDs and priorities
            const uniqueRules = rules.map((rule, index) => ({
              ...rule,
              id: `rule-${index}`,
              priority: index,
              requirements: {
                minImdbVotes: 0, // Always matches
              },
            }));

            // Sort rules by priority to find expected winner
            const sortedRules = [...uniqueRules].sort((a, b) => a.priority - b.priority);
            const expectedRuleId = sortedRules[0].id;

            const policy: PolicyConfig = {
              allowedCountries: ['US'],
              blockedCountries: ['RU'], // Block to trigger breakout check
              blockedCountryMode: 'ANY',
              allowedLanguages: ['en'],
              blockedLanguages: [],
              globalProviders: [],
              breakoutRules: uniqueRules,
              eligibilityMode: 'STRICT',
              homepage: { minRelevanceScore: 50 },
            };

            // Create input with blocked country to trigger breakout
            const blockedInput: PolicyEngineInput = {
              ...input,
              mediaItem: {
                ...input.mediaItem,
                originCountries: ['RU'],
                originalLanguage: 'en',
                voteCountImdb: 100, // Meets requirement
              },
            };

            const result = evaluateEligibility(blockedInput, policy);

            // If eligible via breakout, should use highest priority rule
            if (result.status === EligibilityStatus.ELIGIBLE && result.breakoutRuleId) {
              expect(result.breakoutRuleId).toBe(expectedRuleId);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property: Relevance Score Range
   * Validates: Requirements 3.2
   */
  describe('Property 7: Relevance Score Range', () => {
    it('should always return a score between 0 and 100', () => {
      fc.assert(
        fc.property(policyEngineInputArb, policyConfigArb, (input, policy) => {
          const score = computeRelevance(input, policy);

          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
          expect(Number.isInteger(score)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('should return 0 when stats is null', () => {
      fc.assert(
        fc.property(policyConfigArb, (policy) => {
          const input: PolicyEngineInput = {
            mediaItem: {
              id: 'test',
              originCountries: ['US'],
              originalLanguage: 'en',
              watchProviders: null,
              voteCountImdb: null,
              voteCountTrakt: null,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
            },
            stats: null,
          };

          const score = computeRelevance(input, policy);

          expect(score).toBe(0);
        }),
        { numRuns: 100 },
      );
    });

    it('should return 100 when all scores are 1.0', () => {
      fc.assert(
        fc.property(policyConfigArb, (policy) => {
          const input: PolicyEngineInput = {
            mediaItem: {
              id: 'test',
              originCountries: ['US'],
              originalLanguage: 'en',
              watchProviders: null,
              voteCountImdb: null,
              voteCountTrakt: null,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
            },
            stats: {
              qualityScore: 1.0,
              popularityScore: 1.0,
              freshnessScore: 1.0,
              ratingoScore: 1.0,
            },
          };

          const score = computeRelevance(input, policy);

          expect(score).toBe(100);
        }),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property: Status Consistency
   */
  describe('Additional Property: Status Consistency', () => {
    it('should have consistent status and reasons', () => {
      fc.assert(
        fc.property(policyEngineInputArb, policyConfigArb, (input, policy) => {
          const result = evaluateEligibility(input, policy);

          // PENDING should have missing data reasons
          if (result.status === EligibilityStatus.PENDING) {
            const hasMissingReason =
              result.reasons.includes('MISSING_ORIGIN_COUNTRY') ||
              result.reasons.includes('MISSING_ORIGINAL_LANGUAGE');
            expect(hasMissingReason).toBe(true);
          }

          // ELIGIBLE via breakout should have BREAKOUT_ALLOWED reason
          if (result.status === EligibilityStatus.ELIGIBLE && result.breakoutRuleId) {
            expect(result.reasons).toContain('BREAKOUT_ALLOWED');
          }

          // INELIGIBLE should have blocking reasons
          if (result.status === EligibilityStatus.INELIGIBLE) {
            const hasBlockingReason =
              result.reasons.includes('BLOCKED_COUNTRY') ||
              result.reasons.includes('BLOCKED_LANGUAGE') ||
              result.reasons.includes('NEUTRAL_COUNTRY') ||
              result.reasons.includes('NEUTRAL_LANGUAGE');
            expect(hasBlockingReason).toBe(true);
          }

          // Reasons array should not be empty
          expect(result.reasons.length).toBeGreaterThan(0);
        }),
        { numRuns: 100 },
      );
    });
  });
});
