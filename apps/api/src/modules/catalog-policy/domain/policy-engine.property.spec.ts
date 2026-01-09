import * as fc from 'fast-check';
import {
  evaluateEligibility,
  computeRelevance,
  isReadableTitle,
  getDefaultContextRequirements,
  getContextRequirements,
} from './policy-engine';
import {
  PolicyConfig,
  PolicyEngineInput,
  EvaluationContext,
  NormalizedOffer,
  BreakoutRule,
} from './types/policy.types';
import {
  EligibilityStatus,
  EligibilityStatusType,
  EvaluationContext as EvaluationContextConst,
} from './constants/evaluation.constants';
import { ContentClass } from './classification.service';

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
    normalizedOffers: fc.constant([] as NormalizedOffer[]), // Simplified for now
    voteCountImdb: fc.option(fc.nat({ max: 1000000 })),
    voteCountTrakt: fc.option(fc.nat({ max: 100000 })),
    ratingImdb: fc.option(fc.double({ min: 0, max: 10 })),
    ratingMetacritic: fc.option(fc.nat({ max: 100 })),
    ratingRottenTomatoes: fc.option(fc.nat({ max: 100 })),
    ratingTrakt: fc.option(fc.double({ min: 0, max: 10 })),
    contentClass: fc.constantFrom(
      'mainstream',
      'anime',
      'documentary',
      'reality',
      'kids',
    ) as fc.Arbitrary<ContentClass>,
    title: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
    overview: fc.option(fc.string({ minLength: 0, maxLength: 500 })),
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

  // Helper to create a minimal valid input for inline test cases
  const createTestInput = (
    overrides?: Partial<PolicyEngineInput['mediaItem']>,
  ): PolicyEngineInput => ({
    mediaItem: {
      id: 'test-id',
      originCountries: ['US'],
      originalLanguage: 'en',
      normalizedOffers: [],
      voteCountImdb: null,
      voteCountTrakt: null,
      ratingImdb: null,
      ratingMetacritic: null,
      ratingRottenTomatoes: null,
      ratingTrakt: null,
      contentClass: 'mainstream' as ContentClass,
      title: 'Test Movie',
      // Overview must be 60+ chars to pass trending/homepage context requirements
      overview:
        'A comprehensive test movie description for testing purposes and validation scenarios.',
      ...overrides,
    },
    stats: null,
  });

  describe('Property: Canonical Lowercase Status', () => {
    // Canonical lowercase status values (PENDING removed per Readability & Pending Reform)
    const CANONICAL_STATUSES: EligibilityStatusType[] = [
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
          const UPPERCASE_STATUSES = ['ELIGIBLE', 'INELIGIBLE', 'REVIEW'];
          expect(UPPERCASE_STATUSES).not.toContain(result.status);
        }),
        { numRuns: 100 },
      );
    });
  });

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
              normalizedOffers: [],
              voteCountImdb: null,
              voteCountTrakt: null,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
              contentClass: 'mainstream',
              title: 'Test Movie',
              overview:
                'A comprehensive test movie description for testing purposes and validation scenarios.',
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
              normalizedOffers: [],
              voteCountImdb: null,
              voteCountTrakt: null,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
              contentClass: 'mainstream',
              title: 'Test Movie',
              overview:
                'A comprehensive test movie description for testing purposes and validation scenarios.',
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

  describe('Additional Property: Status Consistency', () => {
    it('should have consistent status and reasons', () => {
      fc.assert(
        fc.property(policyEngineInputArb, policyConfigArb, (input, policy) => {
          const result = evaluateEligibility(input, policy);

          // Per Readability & Pending Reform: PENDING is no longer returned by Policy Engine
          // Missing data now returns INELIGIBLE with umbrella + specific reasons
          expect(result.status).not.toBe('pending');

          // ELIGIBLE via breakout should have BREAKOUT_ALLOWED reason
          if (result.status === EligibilityStatus.ELIGIBLE && result.breakoutRuleId) {
            expect(result.reasons).toContain('BREAKOUT_ALLOWED');
          }

          // INELIGIBLE should have blocking reasons (including new readability reasons)
          if (result.status === EligibilityStatus.INELIGIBLE) {
            const hasBlockingReason =
              result.reasons.includes('BLOCKED_COUNTRY') ||
              result.reasons.includes('BLOCKED_LANGUAGE') ||
              result.reasons.includes('NEUTRAL_COUNTRY') ||
              result.reasons.includes('NEUTRAL_LANGUAGE') ||
              result.reasons.includes('MISSING_REQUIRED_METADATA') ||
              result.reasons.includes('MISSING_ORIGIN_COUNTRY') ||
              result.reasons.includes('MISSING_ORIGINAL_LANGUAGE') ||
              result.reasons.includes('MISSING_TITLE') ||
              result.reasons.includes('MISSING_TRANSLATED_TITLE') ||
              result.reasons.includes('MISSING_OVERVIEW') ||
              result.reasons.includes('MISSING_GLOBAL_SIGNALS') ||
              result.reasons.includes('EXCLUDED_CONTENT_CLASS');
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

describe('Context-Aware Eligibility Properties', () => {
  // Arbitraries for context-aware tests
  const countryCodeArb = fc.stringMatching(/^[A-Z]{2}$/);
  const languageCodeArb = fc.stringMatching(/^[a-z]{2}$/);

  const mediaItemArb = fc.record({
    id: fc.uuid(),
    originCountries: fc.option(fc.array(countryCodeArb, { minLength: 1, maxLength: 5 })),
    originalLanguage: fc.option(languageCodeArb),
    normalizedOffers: fc.constant([] as NormalizedOffer[]),
    voteCountImdb: fc.option(fc.nat({ max: 1000000 })),
    voteCountTrakt: fc.option(fc.nat({ max: 100000 })),
    ratingImdb: fc.option(fc.double({ min: 0, max: 10 })),
    ratingMetacritic: fc.option(fc.nat({ max: 100 })),
    ratingRottenTomatoes: fc.option(fc.nat({ max: 100 })),
    ratingTrakt: fc.option(fc.double({ min: 0, max: 10 })),
    contentClass: fc.constantFrom(
      'mainstream',
      'anime',
      'documentary',
      'reality',
      'kids',
    ) as fc.Arbitrary<ContentClass>,
    title: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
    overview: fc.option(fc.string({ minLength: 0, maxLength: 500 })),
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

  const ALL_CONTEXTS: EvaluationContext[] = [
    'catalog',
    'homepage',
    'trending',
    'now_playing',
    'new_digital',
    'search',
  ];

  describe('Property 1: No Context Equals Catalog Context', () => {
    it('should produce identical results when called without options vs with context: catalog', () => {
      fc.assert(
        fc.property(
          policyEngineInputArb,
          fc.nat({ max: 100000 }), // threshold for gate
          fc.boolean(), // whether to include globalRequirements
          fc.subarray(ALL_CONTEXTS, { minLength: 0 }), // appliesTo contexts
          (input, threshold, includeGlobalReqs, appliesTo) => {
            const policy: PolicyConfig = {
              allowedCountries: ['US', 'GB', 'CA'],
              blockedCountries: ['RU', 'CN'],
              blockedCountryMode: 'ANY',
              allowedLanguages: ['en', 'es', 'fr'],
              blockedLanguages: ['ru'],
              globalProviders: [],
              breakoutRules: [],
              eligibilityMode: 'STRICT',
              homepage: { minRelevanceScore: 50 },
              ...(includeGlobalReqs && {
                globalRequirements: {
                  minVotesAnyOf: { sources: ['imdb', 'trakt'], min: threshold },
                  ...(appliesTo.length > 0 && { appliesTo }),
                },
              }),
            };

            // Call without options (legacy mode)
            const resultWithoutOptions = evaluateEligibility(input, policy);

            // Call with explicit context: 'catalog'
            const resultWithCatalogContext = evaluateEligibility(input, policy, {
              context: 'catalog',
            });

            // Results should be identical
            expect(resultWithoutOptions.status).toBe(resultWithCatalogContext.status);
            expect(resultWithoutOptions.reasons).toEqual(resultWithCatalogContext.reasons);
            expect(resultWithoutOptions.breakoutRuleId).toBe(
              resultWithCatalogContext.breakoutRuleId,
            );

            // globalGateDetails should also match
            if (resultWithoutOptions.globalGateDetails) {
              expect(resultWithCatalogContext.globalGateDetails).toBeDefined();
              expect(resultWithoutOptions.globalGateDetails.failedChecks).toEqual(
                resultWithCatalogContext.globalGateDetails?.failedChecks,
              );
            } else {
              expect(resultWithCatalogContext.globalGateDetails).toBeUndefined();
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should produce identical results for all input variations without options vs with catalog context', () => {
      fc.assert(
        fc.property(
          policyEngineInputArb,
          fc.constantFrom('STRICT', 'RELAXED') as fc.Arbitrary<'STRICT' | 'RELAXED'>,
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 20 }),
              name: fc.string({ minLength: 1, maxLength: 50 }),
              priority: fc.nat({ max: 100 }),
              requirements: fc.record({
                minImdbVotes: fc.option(fc.nat({ max: 1000000 })),
              }),
            }),
            { maxLength: 3 },
          ),
          (input, eligibilityMode, breakoutRules) => {
            const policy: PolicyConfig = {
              allowedCountries: ['US'],
              blockedCountries: ['RU'],
              blockedCountryMode: 'ANY',
              allowedLanguages: ['en'],
              blockedLanguages: [],
              globalProviders: [],
              breakoutRules,
              eligibilityMode,
              homepage: { minRelevanceScore: 50 },
              globalRequirements: {
                minVotesAnyOf: { sources: ['imdb'], min: 1000 },
              },
            };

            // Call without options
            const resultWithoutOptions = evaluateEligibility(input, policy);

            // Call with explicit context: 'catalog'
            const resultWithCatalogContext = evaluateEligibility(input, policy, {
              context: 'catalog',
            });

            // All fields should match
            expect(resultWithoutOptions).toEqual(resultWithCatalogContext);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

describe('Global Quality Gate Properties', () => {
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
              normalizedOffers: [],
              voteCountImdb: imdbVotes,
              voteCountTrakt: traktVotes,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
              contentClass: 'mainstream',
              title: 'Test Movie',
              overview:
                'A comprehensive test movie description for testing purposes and validation scenarios.',
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
              normalizedOffers: [],
              voteCountImdb: source === 'imdb' ? votes : null,
              voteCountTrakt: source === 'trakt' ? votes : null,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
              contentClass: 'mainstream',
              title: 'Test Movie',
              overview:
                'A comprehensive test movie description for testing purposes and validation scenarios.',
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
              normalizedOffers: [],
              voteCountImdb: null,
              voteCountTrakt: null,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
              contentClass: 'mainstream',
              title: 'Test Movie',
              overview:
                'A comprehensive test movie description for testing purposes and validation scenarios.',
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
              normalizedOffers: [],
              voteCountImdb: null,
              voteCountTrakt: null,
              ratingImdb: requiredRating === 'imdb' && hasRating ? 7.5 : null,
              ratingMetacritic: requiredRating === 'metacritic' && hasRating ? 75 : null,
              ratingRottenTomatoes: requiredRating === 'rt' && hasRating ? 85 : null,
              ratingTrakt: requiredRating === 'trakt' && hasRating ? 8.0 : null,
              contentClass: 'mainstream',
              title: 'Test Movie',
              overview:
                'A comprehensive test movie description for testing purposes and validation scenarios.',
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
              normalizedOffers: [],
              voteCountImdb: votes,
              voteCountTrakt: null,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
              contentClass: 'mainstream',
              title: 'Test Movie',
              overview:
                'A comprehensive test movie description for testing purposes and validation scenarios.',
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
              normalizedOffers: [],
              voteCountImdb: votes,
              voteCountTrakt: null,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
              contentClass: 'mainstream',
              title: 'Test Movie',
              overview:
                'A comprehensive test movie description for testing purposes and validation scenarios.',
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
              normalizedOffers: [],
              voteCountImdb: imdbVotes,
              voteCountTrakt: traktVotes,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
              contentClass: 'mainstream',
              title: 'Test Movie',
              overview:
                'A comprehensive test movie description for testing purposes and validation scenarios.',
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
              normalizedOffers: [],
              voteCountImdb: votes,
              voteCountTrakt: null,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
              contentClass: 'mainstream',
              title: 'Test Movie',
              overview:
                'A comprehensive test movie description for testing purposes and validation scenarios.',
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
   * For any PolicyConfig with globalRequirements, and for any EvaluationContext:
   * - IF context IS in appliesTo (or appliesTo is undefined and context is in default contexts),
   *   THEN gate SHALL be checked
   * - IF context is NOT in appliesTo, THEN gate SHALL be skipped and content that would fail
   *   gate SHALL still be eligible (if not blocked/neutral)
   */
  describe('Property 2: Context-Aware Gate Application', () => {
    const ALL_CONTEXTS: EvaluationContext[] = [
      'catalog',
      'homepage',
      'trending',
      'now_playing',
      'new_digital',
      'search',
    ];
    const DEFAULT_QUALITY_CONTEXTS: EvaluationContext[] = [
      'catalog',
      'homepage',
      'trending',
      'search',
    ];

    it('should apply gate when context is in appliesTo (explicit configuration)', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 100000 }), // threshold
          fc.option(fc.nat({ max: 100000 })), // votes (can be null or below threshold)
          fc.subarray(ALL_CONTEXTS, { minLength: 1 }), // appliesTo contexts
          (threshold, votes, appliesTo) => {
            // Pick a context that IS in appliesTo
            const context = appliesTo[0];

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
                minVotesAnyOf: { sources: ['imdb'], min: threshold },
                appliesTo,
              },
            };

            const input: PolicyEngineInput = {
              mediaItem: {
                id: 'test',
                originCountries: ['US'], // Allowed
                originalLanguage: 'en', // Allowed
                normalizedOffers: [],
                voteCountImdb: votes,
                voteCountTrakt: null,
                ratingImdb: null,
                ratingMetacritic: null,
                ratingRottenTomatoes: null,
                ratingTrakt: null,
                contentClass: 'mainstream',
                title: 'Test Movie',
                // Overview must be 60+ chars to pass trending/homepage context requirements
                overview:
                  'A comprehensive test movie description for testing purposes and validation scenarios.',
              },
              stats: null,
            };

            const result = evaluateEligibility(input, policy, { context });

            const passesGate = votes !== null && votes >= threshold;

            if (passesGate) {
              // Gate passes → ELIGIBLE
              expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
              expect(result.reasons).toContain('ALLOWED_COUNTRY');
            } else {
              // Gate fails → INELIGIBLE with MISSING_GLOBAL_SIGNALS
              expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
              expect(result.reasons).toContain('MISSING_GLOBAL_SIGNALS');
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should skip gate when context is NOT in appliesTo (explicit configuration)', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 100000 }), // threshold
          fc.option(fc.nat({ max: 100000 })), // votes (can be null or below threshold)
          fc.subarray(ALL_CONTEXTS, { minLength: 1, maxLength: 3 }), // appliesTo contexts
          (threshold, votes, appliesTo) => {
            // Find a context that is NOT in appliesTo
            const excludedContexts = ALL_CONTEXTS.filter((c) => !appliesTo.includes(c));
            fc.pre(excludedContexts.length > 0); // Skip if all contexts are in appliesTo
            const context = excludedContexts[0];

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
                minVotesAnyOf: { sources: ['imdb'], min: threshold },
                appliesTo,
              },
              // Disable overview requirement for this test to focus on gate behavior
              contextRequirements: {
                trending: { requireOverview: false },
                homepage: { requireOverview: false },
              },
            };

            const input: PolicyEngineInput = {
              mediaItem: {
                id: 'test',
                originCountries: ['US'], // Allowed
                originalLanguage: 'en', // Allowed
                normalizedOffers: [],
                voteCountImdb: votes, // May fail gate, but gate should be skipped
                voteCountTrakt: null,
                ratingImdb: null,
                ratingMetacritic: null,
                ratingRottenTomatoes: null,
                ratingTrakt: null,
                contentClass: 'mainstream',
                title: 'Test Movie',
                overview:
                  'A comprehensive test movie description for testing purposes and validation scenarios.',
              },
              stats: null,
            };

            const result = evaluateEligibility(input, policy, { context });

            // Gate should be skipped → ELIGIBLE regardless of votes
            expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
            expect(result.reasons).toContain('ALLOWED_COUNTRY');
            expect(result.reasons).not.toContain('MISSING_GLOBAL_SIGNALS');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should use default contexts when appliesTo is not configured', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 100000 }), // threshold
          fc.option(fc.nat({ max: 100000 })), // votes
          fc.constantFrom(...ALL_CONTEXTS), // any context
          (threshold, votes, context) => {
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
                minVotesAnyOf: { sources: ['imdb'], min: threshold },
                // No appliesTo → defaults to ['catalog', 'homepage', 'trending', 'search']
              },
            };

            const input: PolicyEngineInput = {
              mediaItem: {
                id: 'test',
                originCountries: ['US'],
                originalLanguage: 'en',
                normalizedOffers: [],
                voteCountImdb: votes,
                voteCountTrakt: null,
                ratingImdb: null,
                ratingMetacritic: null,
                ratingRottenTomatoes: null,
                ratingTrakt: null,
                contentClass: 'mainstream',
                title: 'Test Movie',
                // Overview must be 60+ chars to pass trending/homepage context requirements
                overview:
                  'A comprehensive test movie description for testing purposes and validation scenarios.',
              },
              stats: null,
            };

            const result = evaluateEligibility(input, policy, { context });

            const isDefaultContext = DEFAULT_QUALITY_CONTEXTS.includes(context);
            const passesGate = votes !== null && votes >= threshold;

            if (isDefaultContext) {
              // Gate applies for default contexts
              if (passesGate) {
                expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
              } else {
                expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
                expect(result.reasons).toContain('MISSING_GLOBAL_SIGNALS');
              }
            } else {
              // Gate skipped for non-default contexts (now_playing, new_digital)
              expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
              expect(result.reasons).not.toContain('MISSING_GLOBAL_SIGNALS');
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should never apply gate when appliesTo is empty array', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 100000 }), // threshold
          fc.option(fc.nat({ max: 100000 })), // votes
          fc.constantFrom(...ALL_CONTEXTS), // any context
          (threshold, votes, context) => {
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
                minVotesAnyOf: { sources: ['imdb'], min: threshold },
                appliesTo: [], // Empty array = gate never applies
              },
              // Disable overview requirement for this test to focus on gate behavior
              contextRequirements: {
                trending: { requireOverview: false },
                homepage: { requireOverview: false },
              },
            };

            const input: PolicyEngineInput = {
              mediaItem: {
                id: 'test',
                originCountries: ['US'],
                originalLanguage: 'en',
                normalizedOffers: [],
                voteCountImdb: votes, // May fail gate, but gate should be skipped
                voteCountTrakt: null,
                ratingImdb: null,
                ratingMetacritic: null,
                ratingRottenTomatoes: null,
                ratingTrakt: null,
                contentClass: 'mainstream',
                title: 'Test Movie',
                overview:
                  'A comprehensive test movie description for testing purposes and validation scenarios.',
              },
              stats: null,
            };

            const result = evaluateEligibility(input, policy, { context });

            // Gate should never apply → ELIGIBLE regardless of votes
            expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
            expect(result.reasons).toContain('ALLOWED_COUNTRY');
            expect(result.reasons).not.toContain('MISSING_GLOBAL_SIGNALS');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should still block content regardless of context (hard blocks override)', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 100000 }), // threshold
          fc.option(fc.nat({ max: 100000 })), // votes
          fc.constantFrom(...ALL_CONTEXTS), // any context
          (threshold, votes, context) => {
            const policy: PolicyConfig = {
              allowedCountries: ['US'],
              blockedCountries: ['RU'],
              blockedCountryMode: 'ANY',
              allowedLanguages: ['en'],
              blockedLanguages: [],
              globalProviders: [],
              breakoutRules: [],
              eligibilityMode: 'STRICT',
              homepage: { minRelevanceScore: 50 },
              globalRequirements: {
                minVotesAnyOf: { sources: ['imdb'], min: threshold },
                appliesTo: [], // Gate never applies
              },
              // Disable overview requirement for this test to focus on blocked behavior
              contextRequirements: {
                trending: { requireOverview: false },
                homepage: { requireOverview: false },
              },
            };

            const input: PolicyEngineInput = {
              mediaItem: {
                id: 'test',
                originCountries: ['RU'], // Blocked
                originalLanguage: 'en',
                normalizedOffers: [],
                voteCountImdb: votes,
                voteCountTrakt: null,
                ratingImdb: null,
                ratingMetacritic: null,
                ratingRottenTomatoes: null,
                ratingTrakt: null,
                contentClass: 'mainstream',
                title: 'Test Movie',
                overview:
                  'A comprehensive test movie description for testing purposes and validation scenarios.',
              },
              stats: null,
            };

            const result = evaluateEligibility(input, policy, { context });

            // Blocked content stays blocked regardless of context
            expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
            expect(result.reasons).toContain('BLOCKED_COUNTRY');
          },
        ),
        { numRuns: 100 },
      );
    });
  });

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
              normalizedOffers: [],
              voteCountImdb: votes,
              voteCountTrakt: null,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
              contentClass: 'mainstream',
              title: 'Test Movie',
              overview:
                'A comprehensive test movie description for testing purposes and validation scenarios.',
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

/**
 * Content Classification Property Tests
 */
describe('Content Classification Properties', () => {
  const countryCodeArb = fc.stringMatching(/^[A-Z]{2}$/);
  const languageCodeArb = fc.stringMatching(/^[a-z]{2}$/);
  const contentClassArb = fc.constantFrom(
    'mainstream',
    'anime',
    'documentary',
    'reality',
    'kids',
  ) as fc.Arbitrary<ContentClass>;

  const mediaItemArb = fc.record({
    id: fc.uuid(),
    originCountries: fc.option(fc.array(countryCodeArb, { minLength: 1, maxLength: 5 })),
    originalLanguage: fc.option(languageCodeArb),
    normalizedOffers: fc.constant([] as NormalizedOffer[]),
    voteCountImdb: fc.option(fc.nat({ max: 1000000 })),
    voteCountTrakt: fc.option(fc.nat({ max: 100000 })),
    ratingImdb: fc.option(fc.double({ min: 0, max: 10 })),
    ratingMetacritic: fc.option(fc.nat({ max: 100 })),
    ratingRottenTomatoes: fc.option(fc.nat({ max: 100 })),
    ratingTrakt: fc.option(fc.double({ min: 0, max: 10 })),
    contentClass: contentClassArb,
    title: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
    overview: fc.option(fc.string({ minLength: 0, maxLength: 500 })),
  });

  const policyEngineInputArb = fc.record({
    mediaItem: mediaItemArb,
    stats: fc.option(
      fc.record({
        qualityScore: fc.option(fc.double({ min: 0, max: 1 })),
        popularityScore: fc.option(fc.double({ min: 0, max: 1 })),
        freshnessScore: fc.option(fc.double({ min: 0, max: 1 })),
        ratingoScore: fc.option(fc.double({ min: 0, max: 1 })),
      }),
    ),
  });

  describe('Property 2: Content Class Filtering with Breakout Override', () => {
    it('should include EXCLUDED_CONTENT_CLASS in reasons when content class is excluded', () => {
      fc.assert(
        fc.property(contentClassArb, (excludedClass) => {
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
            excludedContentClasses: [excludedClass],
          };

          const input: PolicyEngineInput = {
            mediaItem: {
              id: 'test',
              originCountries: ['US'],
              originalLanguage: 'en',
              normalizedOffers: [],
              voteCountImdb: null,
              voteCountTrakt: null,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
              contentClass: excludedClass,
              title: 'Test Movie',
              overview:
                'A comprehensive test movie description for testing purposes and validation scenarios.',
            },
            stats: null,
          };

          const result = evaluateEligibility(input, policy);

          // Excluded content class → INELIGIBLE with EXCLUDED_CONTENT_CLASS
          expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
          expect(result.reasons).toContain('EXCLUDED_CONTENT_CLASS');
        }),
        { numRuns: 100 },
      );
    });

    it('should NOT include EXCLUDED_CONTENT_CLASS when content class is not excluded', () => {
      fc.assert(
        fc.property(contentClassArb, contentClassArb, (excludedClass, mediaClass) => {
          fc.pre(excludedClass !== mediaClass);

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
            excludedContentClasses: [excludedClass],
          };

          const input: PolicyEngineInput = {
            mediaItem: {
              id: 'test',
              originCountries: ['US'],
              originalLanguage: 'en',
              normalizedOffers: [],
              voteCountImdb: null,
              voteCountTrakt: null,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
              contentClass: mediaClass,
              title: 'Test Movie',
              overview:
                'A comprehensive test movie description for testing purposes and validation scenarios.',
            },
            stats: null,
          };

          const result = evaluateEligibility(input, policy);

          // Non-excluded content class → reasons should NOT contain EXCLUDED_CONTENT_CLASS
          expect(result.reasons).not.toContain('EXCLUDED_CONTENT_CLASS');
        }),
        { numRuns: 100 },
      );
    });

    it('should NOT include EXCLUDED_CONTENT_CLASS when excludedContentClasses is empty', () => {
      fc.assert(
        fc.property(contentClassArb, (mediaClass) => {
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
            excludedContentClasses: [],
          };

          const input: PolicyEngineInput = {
            mediaItem: {
              id: 'test',
              originCountries: ['US'],
              originalLanguage: 'en',
              normalizedOffers: [],
              voteCountImdb: null,
              voteCountTrakt: null,
              ratingImdb: null,
              ratingMetacritic: null,
              ratingRottenTomatoes: null,
              ratingTrakt: null,
              contentClass: mediaClass,
              title: 'Test Movie',
              overview:
                'A comprehensive test movie description for testing purposes and validation scenarios.',
            },
            stats: null,
          };

          const result = evaluateEligibility(input, policy);

          expect(result.reasons).not.toContain('EXCLUDED_CONTENT_CLASS');
        }),
        { numRuns: 100 },
      );
    });

    it('should include both EXCLUDED_CONTENT_CLASS and BREAKOUT_ALLOWED when breakout passes', () => {
      fc.assert(
        fc.property(
          contentClassArb,
          fc.nat({ max: 100000 }),
          (excludedClass, breakoutThreshold) => {
            const policy: PolicyConfig = {
              allowedCountries: ['US'],
              blockedCountries: [],
              blockedCountryMode: 'ANY',
              allowedLanguages: ['en'],
              blockedLanguages: [],
              globalProviders: [],
              breakoutRules: [
                {
                  id: 'test-breakout',
                  name: 'Test Breakout',
                  priority: 1,
                  requirements: {
                    minImdbVotes: breakoutThreshold,
                  },
                },
              ],
              eligibilityMode: 'STRICT',
              homepage: { minRelevanceScore: 50 },
              excludedContentClasses: [excludedClass],
            };

            const input: PolicyEngineInput = {
              mediaItem: {
                id: 'test',
                originCountries: ['US'],
                originalLanguage: 'en',
                normalizedOffers: [],
                voteCountImdb: breakoutThreshold + 1000, // Passes breakout
                voteCountTrakt: null,
                ratingImdb: null,
                ratingMetacritic: null,
                ratingRottenTomatoes: null,
                ratingTrakt: null,
                contentClass: excludedClass,
                title: 'Test Movie',
                overview:
                  'A comprehensive test movie description for testing purposes and validation scenarios.',
              },
              stats: null,
            };

            const result = evaluateEligibility(input, policy);

            // Excluded + breakout passes → ELIGIBLE with both reasons
            expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
            expect(result.reasons).toContain('EXCLUDED_CONTENT_CLASS');
            expect(result.reasons).toContain('BREAKOUT_ALLOWED');
            expect(result.breakoutRuleId).toBe('test-breakout');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return INELIGIBLE with BLOCKED when breakout passes but geo is blocked (hard block)', () => {
      fc.assert(
        fc.property(
          contentClassArb,
          fc.nat({ max: 100000 }),
          (excludedClass, breakoutThreshold) => {
            const policy: PolicyConfig = {
              allowedCountries: ['US'],
              blockedCountries: ['RU'],
              blockedCountryMode: 'ANY',
              allowedLanguages: ['en'],
              blockedLanguages: [],
              globalProviders: [],
              breakoutRules: [
                {
                  id: 'test-breakout',
                  name: 'Test Breakout',
                  priority: 1,
                  requirements: {
                    minImdbVotes: breakoutThreshold,
                  },
                },
              ],
              eligibilityMode: 'STRICT',
              homepage: { minRelevanceScore: 50 },
              excludedContentClasses: [excludedClass],
            };

            const input: PolicyEngineInput = {
              mediaItem: {
                id: 'test',
                originCountries: ['RU'], // Blocked country
                originalLanguage: 'en',
                normalizedOffers: [],
                voteCountImdb: breakoutThreshold + 1000, // Passes breakout
                voteCountTrakt: null,
                ratingImdb: null,
                ratingMetacritic: null,
                ratingRottenTomatoes: null,
                ratingTrakt: null,
                contentClass: excludedClass,
                title: 'Test Movie',
                overview:
                  'A comprehensive test movie description for testing purposes and validation scenarios.',
              },
              stats: null,
            };

            const result = evaluateEligibility(input, policy);

            // Excluded + breakout + blocked → INELIGIBLE (hard block wins)
            expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
            expect(result.reasons).toContain('EXCLUDED_CONTENT_CLASS');
            expect(result.reasons).toContain('BLOCKED_COUNTRY');
            expect(result.breakoutRuleId).toBeNull();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  describe('Property 5: Evaluation Order Invariant', () => {
    // Per Readability & Pending Reform: missing data returns INELIGIBLE with umbrella + specific reasons
    it('should return INELIGIBLE for missing originCountries regardless of content class', () => {
      fc.assert(
        fc.property(
          contentClassArb,
          fc.array(contentClassArb, { maxLength: 3 }),
          (mediaClass, excludedClasses) => {
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
              excludedContentClasses: excludedClasses,
            };

            const input: PolicyEngineInput = {
              mediaItem: {
                id: 'test',
                originCountries: null, // Missing
                originalLanguage: 'en',
                normalizedOffers: [],
                voteCountImdb: null,
                voteCountTrakt: null,
                ratingImdb: null,
                ratingMetacritic: null,
                ratingRottenTomatoes: null,
                ratingTrakt: null,
                contentClass: mediaClass,
                title: 'Test Movie',
                overview:
                  'A comprehensive test movie description for testing purposes and validation scenarios.',
              },
              stats: null,
            };

            const result = evaluateEligibility(input, policy);

            // Missing data → INELIGIBLE with umbrella + specific reasons
            expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
            expect(result.reasons).toContain('MISSING_REQUIRED_METADATA');
            expect(result.reasons).toContain('MISSING_ORIGIN_COUNTRY');
            expect(result.reasons).not.toContain('EXCLUDED_CONTENT_CLASS');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return INELIGIBLE for empty originCountries regardless of content class', () => {
      fc.assert(
        fc.property(
          contentClassArb,
          fc.array(contentClassArb, { maxLength: 3 }),
          (mediaClass, excludedClasses) => {
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
              excludedContentClasses: excludedClasses,
            };

            const input: PolicyEngineInput = {
              mediaItem: {
                id: 'test',
                originCountries: [], // Empty
                originalLanguage: 'en',
                normalizedOffers: [],
                voteCountImdb: null,
                voteCountTrakt: null,
                ratingImdb: null,
                ratingMetacritic: null,
                ratingRottenTomatoes: null,
                ratingTrakt: null,
                contentClass: mediaClass,
                title: 'Test Movie',
                overview:
                  'A comprehensive test movie description for testing purposes and validation scenarios.',
              },
              stats: null,
            };

            const result = evaluateEligibility(input, policy);

            expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
            expect(result.reasons).toContain('MISSING_REQUIRED_METADATA');
            expect(result.reasons).toContain('MISSING_ORIGIN_COUNTRY');
            expect(result.reasons).not.toContain('EXCLUDED_CONTENT_CLASS');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return INELIGIBLE for missing originalLanguage regardless of content class', () => {
      fc.assert(
        fc.property(
          contentClassArb,
          fc.array(contentClassArb, { maxLength: 3 }),
          (mediaClass, excludedClasses) => {
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
              excludedContentClasses: excludedClasses,
            };

            const input: PolicyEngineInput = {
              mediaItem: {
                id: 'test',
                originCountries: ['US'],
                originalLanguage: null, // Missing
                normalizedOffers: [],
                voteCountImdb: null,
                voteCountTrakt: null,
                ratingImdb: null,
                ratingMetacritic: null,
                ratingRottenTomatoes: null,
                ratingTrakt: null,
                contentClass: mediaClass,
                title: 'Test Movie',
                overview:
                  'A comprehensive test movie description for testing purposes and validation scenarios.',
              },
              stats: null,
            };

            const result = evaluateEligibility(input, policy);

            expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
            expect(result.reasons).toContain('MISSING_REQUIRED_METADATA');
            expect(result.reasons).toContain('MISSING_ORIGINAL_LANGUAGE');
            expect(result.reasons).not.toContain('EXCLUDED_CONTENT_CLASS');
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

/**
 * Property 3: Readability Classification
 * Feature: readability-pending-reform
 *
 * Tests that isReadableTitle correctly classifies titles:
 * - Titles with 2+ Latin/Cyrillic letters are always readable
 * - CJK-heavy titles (>60% CJK, <2 Latin/Cyrillic, length > 6) are unreadable
 *
 * **Validates: Requirements 3.2, 3.3**
 */
describe('Readability Classification Properties', () => {
  // Arbitrary for Latin characters
  const latinCharArb = fc.constantFrom(
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
    'g',
    'h',
    'i',
    'j',
    'k',
    'l',
    'm',
    'n',
    'o',
    'p',
    'q',
    'r',
    's',
    't',
    'u',
    'v',
    'w',
    'x',
    'y',
    'z',
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'J',
    'K',
    'L',
    'M',
    'N',
    'O',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
    'Z',
  );

  // Arbitrary for Cyrillic characters
  const cyrillicCharArb = fc.constantFrom(
    'а',
    'б',
    'в',
    'г',
    'д',
    'е',
    'ж',
    'з',
    'и',
    'й',
    'к',
    'л',
    'м',
    'н',
    'о',
    'п',
    'р',
    'с',
    'т',
    'у',
    'ф',
    'х',
    'ц',
    'ч',
    'ш',
    'щ',
    'ь',
    'ю',
    'я',
    'є',
    'і',
    'ї',
    'ґ',
    'А',
    'Б',
    'В',
    'Г',
    'Д',
    'Е',
    'Ж',
    'З',
    'И',
    'Й',
    'К',
    'Л',
    'М',
    'Н',
    'О',
    'П',
    'Р',
    'С',
    'Т',
    'У',
    'Ф',
    'Х',
    'Ц',
    'Ч',
    'Ш',
    'Щ',
    'Ь',
    'Ю',
    'Я',
    'Є',
    'І',
    'Ї',
    'Ґ',
  );

  // Arbitrary for CJK characters (Han, Hiragana, Katakana, Hangul)
  const cjkCharArb = fc.constantFrom(
    // Han (Chinese)
    '東',
    '京',
    '物',
    '語',
    '中',
    '文',
    '日',
    '本',
    '韓',
    '國',
    '電',
    '影',
    '愛',
    '情',
    '故',
    '事',
    '人',
    '生',
    '世',
    '界',
    // Hiragana
    'あ',
    'い',
    'う',
    'え',
    'お',
    'か',
    'き',
    'く',
    'け',
    'こ',
    // Katakana
    'ア',
    'イ',
    'ウ',
    'エ',
    'オ',
    'カ',
    'キ',
    'ク',
    'ケ',
    'コ',
    // Hangul
    '한',
    '국',
    '영',
    '화',
    '드',
    '라',
    '마',
    '사',
    '랑',
    '이',
  );

  // Arbitrary for Latin/Cyrillic characters (using string type for flexibility)
  const latinCyrillicCharArb: fc.Arbitrary<string> = fc.oneof(latinCharArb, cyrillicCharArb);

  describe('Property 3: Readability Classification', () => {
    it('should classify titles with 2+ Latin/Cyrillic letters as readable', () => {
      fc.assert(
        fc.property(
          // Generate at least 2 Latin/Cyrillic characters
          fc.array(latinCyrillicCharArb, { minLength: 2, maxLength: 10 }),
          // Optional prefix/suffix with any characters (including CJK)
          fc.option(fc.array(cjkCharArb, { minLength: 0, maxLength: 10 })),
          fc.option(fc.array(cjkCharArb, { minLength: 0, maxLength: 10 })),
          (latinCyrillicChars, prefixCjk, suffixCjk) => {
            // Build title with Latin/Cyrillic surrounded by optional CJK
            const prefix = prefixCjk ? prefixCjk.join('') : '';
            const middle = latinCyrillicChars.join('');
            const suffix = suffixCjk ? suffixCjk.join('') : '';
            const title = prefix + middle + suffix;

            // Title with 2+ Latin/Cyrillic should always be readable
            expect(isReadableTitle(title)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should classify CJK-heavy titles without Latin/Cyrillic as unreadable', () => {
      fc.assert(
        fc.property(
          // Generate CJK-only title with length > 6
          fc.array(cjkCharArb, { minLength: 7, maxLength: 20 }),
          (cjkChars) => {
            const title = cjkChars.join('');

            // Pure CJK title with length > 6 should be unreadable
            // (CJK ratio = 100% > 60%, Latin/Cyrillic count = 0 < 2)
            expect(isReadableTitle(title)).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should classify CJK-heavy titles with only 1 Latin/Cyrillic as unreadable', () => {
      fc.assert(
        fc.property(
          // Generate CJK characters (enough to make >60% ratio)
          fc.array(cjkCharArb, { minLength: 7, maxLength: 15 }),
          // Single Latin/Cyrillic character
          latinCyrillicCharArb,
          // Position to insert the Latin/Cyrillic char
          fc.nat(),
          (cjkChars, latinCyrillicChar, positionSeed) => {
            // Insert single Latin/Cyrillic at random position
            const position = positionSeed % (cjkChars.length + 1);
            const chars: string[] = [...cjkChars];
            chars.splice(position, 0, latinCyrillicChar);
            const title = chars.join('');

            // CJK count = cjkChars.length, Latin/Cyrillic count = 1
            // Total letters = cjkChars.length + 1
            // CJK ratio = cjkChars.length / (cjkChars.length + 1)
            // For minLength 7: ratio = 7/8 = 87.5% > 60%
            // Latin/Cyrillic count = 1 < 2
            // Title length > 6
            // Should be unreadable
            expect(isReadableTitle(title)).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should classify short CJK titles (length <= 6) as readable', () => {
      fc.assert(
        fc.property(
          // Generate short CJK-only title (1-6 characters)
          fc.array(cjkCharArb, { minLength: 1, maxLength: 6 }),
          (cjkChars) => {
            const title = cjkChars.join('');

            // Short titles are readable regardless of script
            // (Rule 3: short titles = readable)
            expect(isReadableTitle(title)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return false for empty titles', () => {
      expect(isReadableTitle('')).toBe(false);
    });

    it('should classify mixed titles with 2+ Latin/Cyrillic as readable regardless of CJK ratio', () => {
      fc.assert(
        fc.property(
          // Generate many CJK characters
          fc.array(cjkCharArb, { minLength: 10, maxLength: 50 }),
          // Generate exactly 2 Latin/Cyrillic characters
          fc.tuple(latinCyrillicCharArb, latinCyrillicCharArb),
          (cjkChars, [latin1, latin2]) => {
            // Build title with CJK dominant but 2 Latin/Cyrillic
            const title = cjkChars.join('') + latin1 + latin2;

            // Even with high CJK ratio, 2+ Latin/Cyrillic = readable
            expect(isReadableTitle(title)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

/**
 * Context Requirements Properties
 *
 * Property 6: Default Context Requirements
 * Validates: Requirements 4.5, 4.6, 8.1
 */
describe('Context Requirements Properties', () => {
  // All evaluation contexts
  const ALL_CONTEXTS = [
    EvaluationContextConst.CATALOG,
    EvaluationContextConst.TRENDING,
    EvaluationContextConst.HOMEPAGE,
    EvaluationContextConst.NOW_PLAYING,
    EvaluationContextConst.NEW_DIGITAL,
    EvaluationContextConst.SEARCH,
  ] as const;

  // Contexts that require overview by default
  const OVERVIEW_REQUIRED_CONTEXTS: readonly string[] = [
    EvaluationContextConst.TRENDING,
    EvaluationContextConst.HOMEPAGE,
  ];

  // Default min overview chars
  const DEFAULT_MIN_OVERVIEW_CHARS = 60;

  describe('Property 6: Default Context Requirements', () => {
    /**
     * Feature: readability-pending-reform, Property 6: Default Context Requirements
     * Validates: Requirements 4.5, 4.6, 8.1
     */
    it('should default requireReadableTitle to true for all contexts', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ALL_CONTEXTS), (context) => {
          const defaults = getDefaultContextRequirements(context);

          // requireReadableTitle should always be true by default
          expect(defaults.requireReadableTitle).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it('should default requireOverview to true only for trending and homepage contexts', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ALL_CONTEXTS), (context) => {
          const defaults = getDefaultContextRequirements(context);

          const shouldRequireOverview = OVERVIEW_REQUIRED_CONTEXTS.includes(context);
          expect(defaults.requireOverview).toBe(shouldRequireOverview);
        }),
        { numRuns: 100 },
      );
    });

    it('should default minOverviewChars to 60 when requireOverview is true, 0 otherwise', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ALL_CONTEXTS), (context) => {
          const defaults = getDefaultContextRequirements(context);

          if (defaults.requireOverview) {
            expect(defaults.minOverviewChars).toBe(DEFAULT_MIN_OVERVIEW_CHARS);
          } else {
            expect(defaults.minOverviewChars).toBe(0);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should return fully populated Required<ContextRequirements> with all fields defined', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ALL_CONTEXTS), (context) => {
          const defaults = getDefaultContextRequirements(context);

          // All fields should be defined (not undefined)
          expect(defaults.requireReadableTitle).toBeDefined();
          expect(defaults.requireOverview).toBeDefined();
          expect(defaults.minOverviewChars).toBeDefined();

          // Types should be correct
          expect(typeof defaults.requireReadableTitle).toBe('boolean');
          expect(typeof defaults.requireOverview).toBe('boolean');
          expect(typeof defaults.minOverviewChars).toBe('number');
        }),
        { numRuns: 100 },
      );
    });
  });

  describe('getContextRequirements merging', () => {
    /**
     * Feature: readability-pending-reform, Property 6: Default Context Requirements
     * Validates: Requirements 8.1
     */
    it('should use defaults when contextRequirements is not configured in policy', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ALL_CONTEXTS), (context) => {
          // Policy without contextRequirements
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
            // No contextRequirements
          };

          const result = getContextRequirements(policy, context);
          const defaults = getDefaultContextRequirements(context);

          // Should match defaults exactly
          expect(result).toEqual(defaults);
        }),
        { numRuns: 100 },
      );
    });

    it('should use defaults when context is not in contextRequirements', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALL_CONTEXTS),
          fc.constantFrom(...ALL_CONTEXTS),
          (configuredContext, queriedContext) => {
            // Skip if same context (would be configured)
            fc.pre(configuredContext !== queriedContext);

            // Policy with contextRequirements for a different context
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
              contextRequirements: {
                [configuredContext]: {
                  requireReadableTitle: false,
                  requireOverview: true,
                  minOverviewChars: 100,
                },
              },
            };

            const result = getContextRequirements(policy, queriedContext);
            const defaults = getDefaultContextRequirements(queriedContext);

            // Should match defaults for non-configured context
            expect(result).toEqual(defaults);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should merge configured values with defaults for partial configuration', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ALL_CONTEXTS), fc.boolean(), (context, configuredValue) => {
          // Policy with partial contextRequirements (only requireReadableTitle)
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
            contextRequirements: {
              [context]: {
                requireReadableTitle: configuredValue,
                // requireOverview and minOverviewChars not configured
              },
            },
          };

          const result = getContextRequirements(policy, context);
          const defaults = getDefaultContextRequirements(context);

          // Configured value should override
          expect(result.requireReadableTitle).toBe(configuredValue);
          // Non-configured values should use defaults
          expect(result.requireOverview).toBe(defaults.requireOverview);
          expect(result.minOverviewChars).toBe(defaults.minOverviewChars);
        }),
        { numRuns: 100 },
      );
    });

    it('should fully override when all values are configured', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...ALL_CONTEXTS),
          fc.boolean(),
          fc.boolean(),
          fc.nat({ max: 500 }),
          (context, requireReadableTitle, requireOverview, minOverviewChars) => {
            // Policy with full contextRequirements
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
              contextRequirements: {
                [context]: {
                  requireReadableTitle,
                  requireOverview,
                  minOverviewChars,
                },
              },
            };

            const result = getContextRequirements(policy, context);

            // All values should match configured
            expect(result.requireReadableTitle).toBe(requireReadableTitle);
            expect(result.requireOverview).toBe(requireOverview);
            expect(result.minOverviewChars).toBe(minOverviewChars);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});

/**
 * Readability & Pending Reform Property Tests
 *
 * These tests validate the reform that removes PENDING status from Policy Engine
 * and adds readability/overview checks.
 */
describe('Readability & Pending Reform Properties', () => {
  // Arbitraries for property-based testing
  const countryCodeArb = fc.stringMatching(/^[A-Z]{2}$/);
  const languageCodeArb = fc.stringMatching(/^[a-z]{2}$/);

  const ALL_CONTEXTS: EvaluationContext[] = [
    'catalog',
    'homepage',
    'trending',
    'now_playing',
    'new_digital',
    'search',
  ];

  // Arbitrary for CJK-heavy titles (unreadable for UA audience)
  const cjkHeavyTitleArb = fc
    .array(fc.constantFrom('東', '京', '物', '語', '한', '국', '中', '文', '日', '本'), {
      minLength: 7,
      maxLength: 20,
    })
    .map((chars) => chars.join(''));

  // Arbitrary for readable titles (with Latin/Cyrillic)
  const readableTitleArb = fc
    .tuple(
      fc.string({ minLength: 2, maxLength: 10 }),
      fc.constantFrom('Movie', 'Film', 'Show', 'Series', 'Story'),
    )
    .map(([prefix, suffix]) => `${prefix} ${suffix}`);

  // Arbitrary for valid overview (meets minimum length after trim)
  // Uses alphanumeric + spaces to ensure trim() doesn't reduce length below 60
  const validOverviewArb = fc
    .array(
      fc.constantFrom(
        ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.split(''),
      ),
      {
        minLength: 65,
        maxLength: 200,
      },
    )
    .map((chars) => chars.join('').trim())
    .filter((s) => s.length >= 60);

  // Arbitrary for short/invalid overview
  const shortOverviewArb = fc.string({ minLength: 0, maxLength: 59 });

  // Base policy config for tests
  const createBasePolicy = (): PolicyConfig => ({
    allowedCountries: ['US', 'GB', 'UA'],
    blockedCountries: ['RU'],
    blockedCountryMode: 'ANY',
    allowedLanguages: ['en', 'uk'],
    blockedLanguages: [],
    globalProviders: [],
    breakoutRules: [],
    eligibilityMode: 'STRICT',
    homepage: { minRelevanceScore: 50 },
  });

  // Base input for tests
  const createBaseInput = (
    overrides?: Partial<PolicyEngineInput['mediaItem']>,
  ): PolicyEngineInput => ({
    mediaItem: {
      id: 'test-id',
      originCountries: ['US'],
      originalLanguage: 'en',
      normalizedOffers: [] as NormalizedOffer[],
      voteCountImdb: 10000,
      voteCountTrakt: 5000,
      ratingImdb: 7.5,
      ratingMetacritic: 75,
      ratingRottenTomatoes: 80,
      ratingTrakt: 7.8,
      contentClass: 'mainstream' as ContentClass,
      title: 'Test Movie',
      overview:
        'A test movie description that is long enough to meet the minimum overview requirements for display contexts.',
      ...overrides,
    },
    stats: {
      qualityScore: 0.8,
      popularityScore: 0.7,
      freshnessScore: 0.6,
      ratingoScore: 0.75,
    },
  });

  /**
   * Property 1: No PENDING Status
   * For any valid PolicyEngineInput and PolicyConfig, the evaluateEligibility function
   * SHALL return a status that is either 'eligible' or 'ineligible', never 'pending'.
   * **Validates: Requirements 1.1**
   */
  describe('Property 1: No PENDING Status', () => {
    it('should never return PENDING status for any input', () => {
      const mediaItemArb = fc.record({
        id: fc.uuid(),
        originCountries: fc.option(fc.array(countryCodeArb, { minLength: 0, maxLength: 5 })),
        originalLanguage: fc.option(languageCodeArb),
        normalizedOffers: fc.constant([] as NormalizedOffer[]),
        voteCountImdb: fc.option(fc.nat({ max: 1000000 })),
        voteCountTrakt: fc.option(fc.nat({ max: 100000 })),
        ratingImdb: fc.option(fc.double({ min: 0, max: 10 })),
        ratingMetacritic: fc.option(fc.nat({ max: 100 })),
        ratingRottenTomatoes: fc.option(fc.nat({ max: 100 })),
        ratingTrakt: fc.option(fc.double({ min: 0, max: 10 })),
        contentClass: fc.constantFrom(
          'mainstream',
          'anime',
          'documentary',
          'reality',
          'kids',
        ) as fc.Arbitrary<ContentClass>,
        title: fc.option(fc.string({ minLength: 0, maxLength: 100 })),
        overview: fc.option(fc.string({ minLength: 0, maxLength: 500 })),
      });

      const policyConfigArb = fc.record({
        allowedCountries: fc.array(countryCodeArb, { minLength: 1, maxLength: 20 }),
        blockedCountries: fc.array(countryCodeArb, { maxLength: 10 }),
        blockedCountryMode: fc.constantFrom('ANY', 'MAJORITY') as fc.Arbitrary<'ANY' | 'MAJORITY'>,
        allowedLanguages: fc.array(languageCodeArb, { minLength: 1, maxLength: 10 }),
        blockedLanguages: fc.array(languageCodeArb, { maxLength: 5 }),
        globalProviders: fc.array(fc.string(), { maxLength: 10 }),
        breakoutRules: fc.constant([] as BreakoutRule[]),
        eligibilityMode: fc.constantFrom('STRICT', 'RELAXED') as fc.Arbitrary<'STRICT' | 'RELAXED'>,
        homepage: fc.record({ minRelevanceScore: fc.nat({ max: 100 }) }),
      });

      fc.assert(
        fc.property(
          mediaItemArb,
          policyConfigArb,
          fc.constantFrom(...ALL_CONTEXTS),
          (mediaItem, policy, context) => {
            const input: PolicyEngineInput = {
              mediaItem: mediaItem as unknown as PolicyEngineInput['mediaItem'],
              stats: null,
            };
            const result = evaluateEligibility(input, policy as unknown as PolicyConfig, {
              context: context as EvaluationContext,
            });

            // Status must be 'eligible' or 'ineligible', never 'pending'
            expect(result.status).not.toBe('pending');
            expect([EligibilityStatus.ELIGIBLE, EligibilityStatus.INELIGIBLE]).toContain(
              result.status,
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 2: Missing Data Returns INELIGIBLE with Umbrella + Specific Reasons
   * For any PolicyEngineInput where originCountries is null/empty OR originalLanguage is null/empty
   * OR title is null/empty, the evaluateEligibility function SHALL return status='ineligible'
   * with reasons array containing MISSING_REQUIRED_METADATA as first element and the specific reason
   * as second element.
   * **Validates: Requirements 1.2, 1.3, 1.4, 5.7**
   */
  describe('Property 2: Missing Data Returns INELIGIBLE with Umbrella + Specific Reasons', () => {
    it('should return INELIGIBLE with MISSING_REQUIRED_METADATA + MISSING_ORIGIN_COUNTRY when originCountries is null/empty', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<string[] | null>(null, []),
          fc.constantFrom(...ALL_CONTEXTS),
          (originCountries, context) => {
            const input = createBaseInput({ originCountries });
            const policy = createBasePolicy();
            const result = evaluateEligibility(input, policy, { context });

            expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
            expect(result.reasons[0]).toBe('MISSING_REQUIRED_METADATA');
            expect(result.reasons[1]).toBe('MISSING_ORIGIN_COUNTRY');
            expect(result.reasons.length).toBe(2);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return INELIGIBLE with MISSING_REQUIRED_METADATA + MISSING_ORIGINAL_LANGUAGE when originalLanguage is null', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ALL_CONTEXTS), (context) => {
          const input = createBaseInput({ originalLanguage: null });
          const policy = createBasePolicy();
          const result = evaluateEligibility(input, policy, { context });

          expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
          expect(result.reasons[0]).toBe('MISSING_REQUIRED_METADATA');
          expect(result.reasons[1]).toBe('MISSING_ORIGINAL_LANGUAGE');
          expect(result.reasons.length).toBe(2);
        }),
        { numRuns: 100 },
      );
    });

    it('should return INELIGIBLE with MISSING_REQUIRED_METADATA + MISSING_TITLE when title is null/empty', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(null, '', '   '),
          fc.constantFrom(...ALL_CONTEXTS),
          (title, context) => {
            const input = createBaseInput({ title });
            const policy = createBasePolicy();
            const result = evaluateEligibility(input, policy, { context });

            expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
            expect(result.reasons[0]).toBe('MISSING_REQUIRED_METADATA');
            expect(result.reasons[1]).toBe('MISSING_TITLE');
            expect(result.reasons.length).toBe(2);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 4: Unreadable Title in Readability-Required Context
   * For any PolicyEngineInput with valid data integrity AND unreadable title (per isReadableTitle)
   * AND context where requireReadableTitle=true, the evaluateEligibility function SHALL return
   * status='ineligible' with reasons containing MISSING_TRANSLATED_TITLE.
   * **Validates: Requirements 3.4, 4.4**
   */
  describe('Property 4: Unreadable Title in Readability-Required Context', () => {
    it('should return INELIGIBLE with MISSING_TRANSLATED_TITLE for CJK-heavy titles', () => {
      fc.assert(
        fc.property(cjkHeavyTitleArb, fc.constantFrom(...ALL_CONTEXTS), (title, context) => {
          // Skip if title happens to have Latin/Cyrillic (edge case in generator)
          fc.pre(!isReadableTitle(title));

          const input = createBaseInput({ title });
          const policy = createBasePolicy();
          // Ensure requireReadableTitle is true (default)
          const result = evaluateEligibility(input, policy, { context });

          expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
          expect(result.reasons).toContain('MISSING_TRANSLATED_TITLE');
        }),
        { numRuns: 100 },
      );
    });

    it('should return ELIGIBLE for readable titles with Latin/Cyrillic', () => {
      fc.assert(
        fc.property(
          readableTitleArb,
          fc.constantFrom('catalog', 'search') as fc.Arbitrary<EvaluationContext>,
          (title, context) => {
            // Ensure title is readable
            fc.pre(isReadableTitle(title));

            const input = createBaseInput({ title });
            const policy = createBasePolicy();
            const result = evaluateEligibility(input, policy, { context });

            // Should not fail on readability
            expect(result.reasons).not.toContain('MISSING_TRANSLATED_TITLE');
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 5: Missing Overview in Overview-Required Context
   * For any PolicyEngineInput with valid data integrity AND readable title AND context where
   * requireOverview=true AND (overview is null/empty OR overview.length < minOverviewChars),
   * the evaluateEligibility function SHALL return status='ineligible' with reasons containing MISSING_OVERVIEW.
   * **Validates: Requirements 4.3, 4.7**
   */
  describe('Property 5: Missing Overview in Overview-Required Context', () => {
    it('should return INELIGIBLE with MISSING_OVERVIEW for missing/short overview in trending/homepage', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(null, '', '   ', 'Short desc'),
          fc.constantFrom('trending', 'homepage') as fc.Arbitrary<EvaluationContext>,
          (overview, context) => {
            const input = createBaseInput({ overview });
            const policy = createBasePolicy();
            const result = evaluateEligibility(input, policy, { context });

            expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
            expect(result.reasons).toContain('MISSING_OVERVIEW');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should return INELIGIBLE with MISSING_OVERVIEW for placeholder overviews', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('TBA', 'N/A', 'Coming soon', 'To be announced'),
          fc.constantFrom('trending', 'homepage') as fc.Arbitrary<EvaluationContext>,
          (overview, context) => {
            const input = createBaseInput({ overview });
            const policy = createBasePolicy();
            const result = evaluateEligibility(input, policy, { context });

            expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
            expect(result.reasons).toContain('MISSING_OVERVIEW');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should NOT require overview for catalog/search contexts by default', () => {
      fc.assert(
        fc.property(
          shortOverviewArb,
          fc.constantFrom('catalog', 'search') as fc.Arbitrary<EvaluationContext>,
          (overview, context) => {
            const input = createBaseInput({ overview });
            const policy = createBasePolicy();
            const result = evaluateEligibility(input, policy, { context });

            // Should not fail on overview for catalog/search
            expect(result.reasons).not.toContain('MISSING_OVERVIEW');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should accept valid overview in trending/homepage', () => {
      fc.assert(
        fc.property(
          validOverviewArb,
          fc.constantFrom('trending', 'homepage') as fc.Arbitrary<EvaluationContext>,
          (overview, context) => {
            const input = createBaseInput({ overview });
            const policy = createBasePolicy();
            const result = evaluateEligibility(input, policy, { context });

            // Should not fail on overview
            expect(result.reasons).not.toContain('MISSING_OVERVIEW');
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  /**
   * Property 7: Evaluation Order Short-Circuit
   * For any PolicyEngineInput that fails Data Integrity check, the returned reasons array SHALL
   * contain ONLY the data integrity reasons, not any subsequent check reasons.
   * For any PolicyEngineInput that passes Data Integrity but fails Display Gates, the returned
   * reasons array SHALL contain ONLY the display gate reason, not any subsequent check reasons.
   * **Validates: Requirements 6.1, 6.2, 6.3**
   */
  describe('Property 7: Evaluation Order Short-Circuit', () => {
    const SUBSEQUENT_REASONS = [
      'BLOCKED_COUNTRY',
      'BLOCKED_LANGUAGE',
      'NEUTRAL_COUNTRY',
      'NEUTRAL_LANGUAGE',
      'MISSING_GLOBAL_SIGNALS',
      'BREAKOUT_ALLOWED',
      'ALLOWED_COUNTRY',
      'ALLOWED_LANGUAGE',
      'EXCLUDED_CONTENT_CLASS',
    ];

    it('should short-circuit on Data Integrity failure (missing origin)', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ALL_CONTEXTS), (context) => {
          const input = createBaseInput({ originCountries: null });
          const policy = createBasePolicy();
          const result = evaluateEligibility(input, policy, { context });

          // Should only have data integrity reasons
          expect(result.reasons).toContain('MISSING_REQUIRED_METADATA');
          expect(result.reasons).toContain('MISSING_ORIGIN_COUNTRY');

          // Should NOT have any subsequent reasons
          for (const reason of SUBSEQUENT_REASONS) {
            expect(result.reasons).not.toContain(reason);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should short-circuit on Data Integrity failure (missing language)', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ALL_CONTEXTS), (context) => {
          const input = createBaseInput({ originalLanguage: null });
          const policy = createBasePolicy();
          const result = evaluateEligibility(input, policy, { context });

          // Should only have data integrity reasons
          expect(result.reasons).toContain('MISSING_REQUIRED_METADATA');
          expect(result.reasons).toContain('MISSING_ORIGINAL_LANGUAGE');

          // Should NOT have any subsequent reasons
          for (const reason of SUBSEQUENT_REASONS) {
            expect(result.reasons).not.toContain(reason);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should short-circuit on Data Integrity failure (missing title)', () => {
      fc.assert(
        fc.property(fc.constantFrom(...ALL_CONTEXTS), (context) => {
          const input = createBaseInput({ title: null });
          const policy = createBasePolicy();
          const result = evaluateEligibility(input, policy, { context });

          // Should only have data integrity reasons
          expect(result.reasons).toContain('MISSING_REQUIRED_METADATA');
          expect(result.reasons).toContain('MISSING_TITLE');

          // Should NOT have any subsequent reasons
          for (const reason of SUBSEQUENT_REASONS) {
            expect(result.reasons).not.toContain(reason);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should short-circuit on Display Gates failure (unreadable title)', () => {
      fc.assert(
        fc.property(cjkHeavyTitleArb, fc.constantFrom(...ALL_CONTEXTS), (title, context) => {
          // Skip if title happens to be readable
          fc.pre(!isReadableTitle(title));

          const input = createBaseInput({ title });
          const policy = createBasePolicy();
          const result = evaluateEligibility(input, policy, { context });

          // Should only have display gate reason
          expect(result.reasons).toContain('MISSING_TRANSLATED_TITLE');

          // Should NOT have data integrity umbrella reason (title exists)
          expect(result.reasons).not.toContain('MISSING_REQUIRED_METADATA');

          // Should NOT have any subsequent reasons
          for (const reason of SUBSEQUENT_REASONS) {
            expect(result.reasons).not.toContain(reason);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('should short-circuit on Display Gates failure (missing overview in trending/homepage)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('trending', 'homepage') as fc.Arbitrary<EvaluationContext>,
          (context) => {
            const input = createBaseInput({ overview: 'Short' });
            const policy = createBasePolicy();
            const result = evaluateEligibility(input, policy, { context });

            // Should only have display gate reason
            expect(result.reasons).toContain('MISSING_OVERVIEW');

            // Should NOT have data integrity umbrella reason
            expect(result.reasons).not.toContain('MISSING_REQUIRED_METADATA');

            // Should NOT have any subsequent reasons
            for (const reason of SUBSEQUENT_REASONS) {
              expect(result.reasons).not.toContain(reason);
            }
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
