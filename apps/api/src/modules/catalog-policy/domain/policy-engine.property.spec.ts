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

/**
 * Global Quality Gate Property Tests
 * Feature: global-quality-gate
 */
describe('Global Quality Gate Properties', () => {
  /**
   * Property 1: minVotesAnyOf Threshold Enforcement (OR logic)
   * Feature: global-quality-gate, Property 1: Votes below threshold on ALL sources → INELIGIBLE
   * Validates: Requirements 1.2, 1.7
   */
  it('Property 1: should enforce minVotesAnyOf threshold with OR logic', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100000 }), // threshold
        fc.option(fc.nat({ max: 100000 })), // imdb votes (can be null)
        fc.option(fc.nat({ max: 100000 })), // trakt votes (can be null)
        (threshold, imdbVotes, traktVotes) => {
          const policy: PolicyConfig = {
            allowedCountries: ['US'],
            blockedCountries: [],
            blockedCountryMode: 'ANY',
            allowedLanguages: ['en'],
            blockedLanguages: [],
            globalProviders: [],
            breakoutRules: [],
            eligibilityMode: 'STRICT',
            homepage: { minRelevanceScore: 50 },
            globalRequirements: {
              minVotesAnyOf: { sources: ['imdb', 'trakt'], min: threshold },
            },
          };

          const input: PolicyEngineInput = {
            mediaItem: {
              id: 'test',
              originCountries: ['US'],
              originalLanguage: 'en',
              watchProviders: null,
              voteCountImdb: imdbVotes,
              voteCountTrakt: traktVotes,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
            },
            stats: null,
          };

          const result = evaluateEligibility(input, policy);

          // OR logic: passes if ANY source meets threshold
          const imdbPasses = imdbVotes !== null && imdbVotes >= threshold;
          const traktPasses = traktVotes !== null && traktVotes >= threshold;
          const anyPasses = imdbPasses || traktPasses;

          if (!anyPasses) {
            expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
            expect(result.reasons).toContain('MISSING_GLOBAL_SIGNALS');
            expect(result.globalGateDetails?.failedChecks).toContain('minVotesAnyOf');
          } else {
            expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
            expect(result.reasons).not.toContain('MISSING_GLOBAL_SIGNALS');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 2: Single Source minVotesAnyOf
   * Feature: global-quality-gate, Property 2: Single source check works correctly
   * Validates: Requirements 1.3, 1.8
   */
  it('Property 2: should enforce minVotesAnyOf with single source', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 50000 }),
        fc.option(fc.nat({ max: 50000 })),
        fc.constantFrom('imdb', 'trakt') as fc.Arbitrary<'imdb' | 'trakt'>,
        (threshold, votes, source) => {
          const policy: PolicyConfig = {
            allowedCountries: ['US'],
            blockedCountries: [],
            blockedCountryMode: 'ANY',
            allowedLanguages: ['en'],
            blockedLanguages: [],
            globalProviders: [],
            breakoutRules: [],
            eligibilityMode: 'STRICT',
            homepage: { minRelevanceScore: 50 },
            globalRequirements: {
              minVotesAnyOf: { sources: [source], min: threshold },
            },
          };

          const input: PolicyEngineInput = {
            mediaItem: {
              id: 'test',
              originCountries: ['US'],
              originalLanguage: 'en',
              watchProviders: null,
              voteCountImdb: source === 'imdb' ? votes : null,
              voteCountTrakt: source === 'trakt' ? votes : null,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
            },
            stats: null,
          };

          const result = evaluateEligibility(input, policy);

          if (votes === null || votes < threshold) {
            expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
            expect(result.reasons).toContain('MISSING_GLOBAL_SIGNALS');
            expect(result.globalGateDetails?.failedChecks).toContain('minVotesAnyOf');
          } else {
            expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
            expect(result.reasons).not.toContain('MISSING_GLOBAL_SIGNALS');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 3: Quality Score Threshold Enforcement
   * Feature: global-quality-gate, Property 3: Quality score below threshold → INELIGIBLE
   * Validates: Requirements 1.4, 1.9
   */
  it('Property 3: should enforce minQualityScoreNormalized threshold', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1 }),
        fc.option(fc.double({ min: 0, max: 1 })),
        (threshold, score) => {
          const policy: PolicyConfig = {
            allowedCountries: ['US'],
            blockedCountries: [],
            blockedCountryMode: 'ANY',
            allowedLanguages: ['en'],
            blockedLanguages: [],
            globalProviders: [],
            breakoutRules: [],
            eligibilityMode: 'STRICT',
            homepage: { minRelevanceScore: 50 },
            globalRequirements: {
              minQualityScoreNormalized: threshold,
            },
          };

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
            stats:
              score !== null
                ? {
                    qualityScore: score,
                    popularityScore: null,
                    freshnessScore: null,
                    ratingoScore: null,
                  }
                : null,
          };

          const result = evaluateEligibility(input, policy);

          if (score === null || score < threshold) {
            expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
            expect(result.reasons).toContain('MISSING_GLOBAL_SIGNALS');
            expect(result.globalGateDetails?.failedChecks).toContain('minQualityScoreNormalized');
          } else {
            expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
            expect(result.reasons).not.toContain('MISSING_GLOBAL_SIGNALS');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 4: Rating Presence Check
   * Feature: global-quality-gate, Property 4: At least one rating must be present
   * Validates: Requirements 1.5, 1.10
   */
  it('Property 4: should enforce requireAnyOfRatingsPresent', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('imdb', 'metacritic', 'rt', 'trakt'),
        fc.boolean(),
        (requiredRating, hasRating) => {
          const policy: PolicyConfig = {
            allowedCountries: ['US'],
            blockedCountries: [],
            blockedCountryMode: 'ANY',
            allowedLanguages: ['en'],
            blockedLanguages: [],
            globalProviders: [],
            breakoutRules: [],
            eligibilityMode: 'STRICT',
            homepage: { minRelevanceScore: 50 },
            globalRequirements: {
              requireAnyOfRatingsPresent: [requiredRating],
            },
          };

          const input: PolicyEngineInput = {
            mediaItem: {
              id: 'test',
              originCountries: ['US'],
              originalLanguage: 'en',
              watchProviders: null,
              voteCountImdb: null,
              voteCountTrakt: null,
              ratingImdb: requiredRating === 'imdb' && hasRating ? 7.5 : null,
              ratingMetacritic: requiredRating === 'metacritic' && hasRating ? 75 : null,
              ratingRottenTomatoes: requiredRating === 'rt' && hasRating ? 85 : null,
              ratingTrakt: requiredRating === 'trakt' && hasRating ? 8.0 : null,
            },
            stats: null,
          };

          const result = evaluateEligibility(input, policy);

          if (!hasRating) {
            expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
            expect(result.reasons).toContain('MISSING_GLOBAL_SIGNALS');
            expect(result.globalGateDetails?.failedChecks).toContain('requireAnyOfRatingsPresent');
          } else {
            expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
            expect(result.reasons).not.toContain('MISSING_GLOBAL_SIGNALS');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 5: AND Logic for Multiple Requirements (votes + quality)
   * Feature: global-quality-gate, Property 5: All requirements must pass
   * Validates: Requirements 1.6
   */
  it('Property 5: should enforce AND logic for multiple requirements', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 50000 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.option(fc.nat({ max: 50000 })),
        fc.option(fc.double({ min: 0, max: 1, noNaN: true })),
        (votesThreshold, qualityThreshold, votes, quality) => {
          const policy: PolicyConfig = {
            allowedCountries: ['US'],
            blockedCountries: [],
            blockedCountryMode: 'ANY',
            allowedLanguages: ['en'],
            blockedLanguages: [],
            globalProviders: [],
            breakoutRules: [],
            eligibilityMode: 'STRICT',
            homepage: { minRelevanceScore: 50 },
            globalRequirements: {
              minVotesAnyOf: { sources: ['imdb', 'trakt'], min: votesThreshold },
              minQualityScoreNormalized: qualityThreshold,
            },
          };

          const input: PolicyEngineInput = {
            mediaItem: {
              id: 'test',
              originCountries: ['US'],
              originalLanguage: 'en',
              watchProviders: null,
              voteCountImdb: votes,
              voteCountTrakt: null,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
            },
            stats:
              quality !== null
                ? {
                    qualityScore: quality,
                    popularityScore: null,
                    freshnessScore: null,
                    ratingoScore: null,
                  }
                : null,
          };

          const result = evaluateEligibility(input, policy);

          const votesPasses = votes !== null && votes >= votesThreshold;
          const qualityPasses = quality !== null && quality >= qualityThreshold;

          // Both must pass for ELIGIBLE
          if (votesPasses && qualityPasses) {
            expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
            expect(result.reasons).not.toContain('MISSING_GLOBAL_SIGNALS');
          } else {
            expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
            expect(result.reasons).toContain('MISSING_GLOBAL_SIGNALS');
            expect(result.globalGateDetails).toBeDefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 6: Global Gate Precedes Access Filters
   * Feature: global-quality-gate, Property 6: Global gate is checked before access filters
   * Validates: Requirements 2.1, 2.2, 3.2, 3.3
   */
  it('Property 6: should check global gate before access filters for non-blocked content', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100000 }),
        fc.option(fc.nat({ max: 100000 })),
        (threshold, votes) => {
          const policy: PolicyConfig = {
            allowedCountries: ['US', 'GB'],
            blockedCountries: [],
            blockedCountryMode: 'ANY',
            allowedLanguages: ['en'],
            blockedLanguages: [],
            globalProviders: [],
            breakoutRules: [],
            eligibilityMode: 'STRICT',
            homepage: { minRelevanceScore: 50 },
            globalRequirements: {
              minVotesAnyOf: { sources: ['imdb'], min: threshold },
            },
          };

          const input: PolicyEngineInput = {
            mediaItem: {
              id: 'test',
              originCountries: ['US'], // Allowed
              originalLanguage: 'en', // Allowed
              watchProviders: null,
              voteCountImdb: votes,
              voteCountTrakt: null,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
            },
            stats: null,
          };

          const result = evaluateEligibility(input, policy);

          // If gate fails, should be INELIGIBLE with MISSING_GLOBAL_SIGNALS
          // even though content is allowed
          if (votes === null || votes < threshold) {
            expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
            expect(result.reasons).toContain('MISSING_GLOBAL_SIGNALS');
            expect(result.reasons).not.toContain('ALLOWED_COUNTRY');
          } else {
            expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
            expect(result.reasons).toContain('ALLOWED_COUNTRY');
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 7: Backward Compatibility
   * Feature: global-quality-gate, Property 7: Policies without globalRequirements work unchanged
   * Validates: Requirements 2.4, 4.1, 4.2, 4.3
   */
  it('Property 7: should skip global gate when not configured', () => {
    fc.assert(
      fc.property(
        fc.option(fc.nat({ max: 100000 })),
        fc.option(fc.nat({ max: 50000 })),
        fc.option(fc.double({ min: 0, max: 1 })),
        (imdbVotes, traktVotes, qualityScore) => {
          const policy: PolicyConfig = {
            allowedCountries: ['US'],
            blockedCountries: [],
            blockedCountryMode: 'ANY',
            allowedLanguages: ['en'],
            blockedLanguages: [],
            globalProviders: [],
            breakoutRules: [],
            eligibilityMode: 'STRICT',
            homepage: { minRelevanceScore: 50 },
            // No globalRequirements configured
          };

          const input: PolicyEngineInput = {
            mediaItem: {
              id: 'test',
              originCountries: ['US'],
              originalLanguage: 'en',
              watchProviders: null,
              voteCountImdb: imdbVotes,
              voteCountTrakt: traktVotes,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
            },
            stats:
              qualityScore !== null
                ? {
                    qualityScore,
                    popularityScore: null,
                    freshnessScore: null,
                    ratingoScore: null,
                  }
                : null,
          };

          const result = evaluateEligibility(input, policy);

          // Should be ELIGIBLE regardless of votes/quality (gate skipped)
          expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
          expect(result.reasons).not.toContain('MISSING_GLOBAL_SIGNALS');
          expect(result.globalGateDetails).toBeUndefined();
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 8: Breakout Rules Cannot Bypass Global Gate
   * Feature: global-quality-gate, Property 8: Blocked content must pass gate to use breakout
   * Validates: Requirements 2.5
   */
  it('Property 8: should prevent breakout when global gate fails', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100000 }),
        fc.nat({ max: 50000 }),
        fc.option(fc.nat({ max: 100000 })),
        (gateThreshold, breakoutThreshold, votes) => {
          // Ensure gate threshold is higher than breakout threshold
          fc.pre(gateThreshold > breakoutThreshold);

          const policy: PolicyConfig = {
            allowedCountries: ['US'],
            blockedCountries: ['RU'],
            blockedCountryMode: 'ANY',
            allowedLanguages: ['en'],
            blockedLanguages: [],
            globalProviders: [],
            breakoutRules: [
              {
                id: 'breakout-1',
                name: 'Breakout Rule',
                priority: 1,
                requirements: {
                  minImdbVotes: breakoutThreshold,
                },
              },
            ],
            eligibilityMode: 'STRICT',
            homepage: { minRelevanceScore: 50 },
            globalRequirements: {
              minVotesAnyOf: { sources: ['imdb'], min: gateThreshold },
            },
          };

          const input: PolicyEngineInput = {
            mediaItem: {
              id: 'test',
              originCountries: ['RU'], // Blocked
              originalLanguage: 'en',
              watchProviders: null,
              voteCountImdb: votes,
              voteCountTrakt: null,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
            },
            stats: null,
          };

          const result = evaluateEligibility(input, policy);

          const passesGate = votes !== null && votes >= gateThreshold;
          const passesBreakout = votes !== null && votes >= breakoutThreshold;

          if (!passesGate) {
            // Gate fails → INELIGIBLE with BLOCKED reason, breakout not attempted
            expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
            expect(result.reasons).toContain('BLOCKED_COUNTRY');
            expect(result.reasons).not.toContain('MISSING_GLOBAL_SIGNALS');
            expect(result.breakoutRuleId).toBeNull();
            expect(result.globalGateDetails).toBeDefined();
          } else if (passesBreakout) {
            // Gate passes AND breakout passes → ELIGIBLE
            expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
            expect(result.reasons).toContain('BREAKOUT_ALLOWED');
            expect(result.breakoutRuleId).toBe('breakout-1');
          } else {
            // Gate passes but breakout fails → INELIGIBLE with BLOCKED reason
            expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
            expect(result.reasons).toContain('BLOCKED_COUNTRY');
            expect(result.breakoutRuleId).toBeNull();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property 10: Reason Precedence Determinism
   * Feature: global-quality-gate, Property 10: Blocked content shows BLOCKED reason, not MISSING_GLOBAL_SIGNALS
   * Validates: Requirements 2.1, 3.3
   */
  it('Property 10: should use BLOCKED reason for blocked content that fails gate', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100000 }),
        fc.option(fc.nat({ max: 100000 })),
        (threshold, votes) => {
          const policy: PolicyConfig = {
            allowedCountries: ['US'],
            blockedCountries: ['RU', 'CN'],
            blockedCountryMode: 'ANY',
            allowedLanguages: ['en'],
            blockedLanguages: ['ru'],
            globalProviders: [],
            breakoutRules: [],
            eligibilityMode: 'STRICT',
            homepage: { minRelevanceScore: 50 },
            globalRequirements: {
              minVotesAnyOf: { sources: ['imdb'], min: threshold },
            },
          };

          const input: PolicyEngineInput = {
            mediaItem: {
              id: 'test',
              originCountries: ['RU'], // Blocked
              originalLanguage: 'ru', // Blocked
              watchProviders: null,
              voteCountImdb: votes,
              voteCountTrakt: null,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
            },
            stats: null,
          };

          const result = evaluateEligibility(input, policy);

          const passesGate = votes !== null && votes >= threshold;

          if (!passesGate) {
            // Blocked AND gate fails → BLOCKED reason takes precedence
            expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
            expect(result.reasons).toContain('BLOCKED_COUNTRY');
            expect(result.reasons).toContain('BLOCKED_LANGUAGE');
            expect(result.reasons).not.toContain('MISSING_GLOBAL_SIGNALS');
            expect(result.globalGateDetails).toBeDefined();
            expect(result.globalGateDetails?.failedChecks).toContain('minVotesAnyOf');
          } else {
            // Blocked but gate passes → still INELIGIBLE with BLOCKED reason
            expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
            expect(result.reasons).toContain('BLOCKED_COUNTRY');
            expect(result.reasons).toContain('BLOCKED_LANGUAGE');
            expect(result.globalGateDetails).toBeUndefined();
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
