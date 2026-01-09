/**
 * Policy Engine Unit Tests
 *
 * Tests for the core policy engine pure functions.
 * Focus on explicit test cases for readability and edge case coverage.
 */

import {
  evaluateEligibility,
  computeRelevance,
  shouldApplyGlobalGate,
  checkContentClassExcluded,
} from './policy-engine';
import { PolicyConfig, PolicyEngineInput, GlobalRequirements } from './types/policy.types';
import { EligibilityStatus, EvaluationContext } from './constants/evaluation.constants';
import { ContentClass } from './classification.service';

describe('Policy Engine', () => {
  // Helper to create a minimal valid policy
  const createPolicy = (overrides?: Partial<PolicyConfig>): PolicyConfig => ({
    allowedCountries: ['US', 'GB', 'CA'],
    blockedCountries: ['RU', 'CN'],
    blockedCountryMode: 'ANY',
    allowedLanguages: ['en', 'uk'],
    blockedLanguages: ['ru'],
    globalProviders: ['Netflix', 'Prime Video'],
    breakoutRules: [],
    eligibilityMode: 'STRICT',
    homepage: {
      minRelevanceScore: 50,
    },
    ...overrides,
  });

  // Helper to create a minimal valid input
  const createInput = (overrides?: Partial<PolicyEngineInput>): PolicyEngineInput => ({
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
      overview: 'A comprehensive test movie description for testing purposes and validation.',
    },
    stats: null,
    ...overrides,
  });

  describe('evaluateEligibility - Missing Data Returns INELIGIBLE', () => {
    // Per Readability & Pending Reform: missing data now returns INELIGIBLE with umbrella + specific reasons
    it('should return INELIGIBLE when originCountries is null', () => {
      const policy = createPolicy();
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: null,
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('MISSING_REQUIRED_METADATA');
      expect(result.reasons).toContain('MISSING_ORIGIN_COUNTRY');
      expect(result.breakoutRuleId).toBeNull();
    });

    it('should return INELIGIBLE when originCountries is empty array', () => {
      const policy = createPolicy();
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: [],
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('MISSING_REQUIRED_METADATA');
      expect(result.reasons).toContain('MISSING_ORIGIN_COUNTRY');
      expect(result.breakoutRuleId).toBeNull();
    });

    it('should return INELIGIBLE when originalLanguage is null', () => {
      const policy = createPolicy();
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originalLanguage: null,
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('MISSING_REQUIRED_METADATA');
      expect(result.reasons).toContain('MISSING_ORIGINAL_LANGUAGE');
      expect(result.breakoutRuleId).toBeNull();
    });

    it('should return INELIGIBLE when originalLanguage is empty string', () => {
      const policy = createPolicy();
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originalLanguage: '',
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('MISSING_REQUIRED_METADATA');
      expect(result.reasons).toContain('MISSING_ORIGINAL_LANGUAGE');
      expect(result.breakoutRuleId).toBeNull();
    });

    it('should return INELIGIBLE when both originCountries and originalLanguage are missing', () => {
      const policy = createPolicy();
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: null,
          originalLanguage: null,
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      // Should return on first missing check (originCountries) with umbrella + specific
      expect(result.reasons).toContain('MISSING_REQUIRED_METADATA');
      expect(result.reasons).toContain('MISSING_ORIGIN_COUNTRY');
      expect(result.breakoutRuleId).toBeNull();
    });

    it('should prioritize missing originCountries over missing originalLanguage', () => {
      const policy = createPolicy();
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: [],
          originalLanguage: '',
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toEqual(['MISSING_REQUIRED_METADATA', 'MISSING_ORIGIN_COUNTRY']);
      expect(result.breakoutRuleId).toBeNull();
    });
  });

  describe('evaluateEligibility - Blocked Without Breakout Returns INELIGIBLE', () => {
    it('should return INELIGIBLE when country is blocked (ANY mode)', () => {
      const policy = createPolicy({
        blockedCountryMode: 'ANY',
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['RU'],
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('BLOCKED_COUNTRY');
      expect(result.breakoutRuleId).toBeNull();
    });

    it('should return INELIGIBLE when language is blocked', () => {
      const policy = createPolicy();
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originalLanguage: 'ru',
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('BLOCKED_LANGUAGE');
      expect(result.breakoutRuleId).toBeNull();
    });

    it('should return INELIGIBLE when both country and language are blocked', () => {
      const policy = createPolicy();
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['RU'],
          originalLanguage: 'ru',
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('BLOCKED_COUNTRY');
      expect(result.reasons).toContain('BLOCKED_LANGUAGE');
      expect(result.breakoutRuleId).toBeNull();
    });

    it('should block when ANY blocked country is present (ANY mode)', () => {
      const policy = createPolicy({
        blockedCountryMode: 'ANY',
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['US', 'RU'], // One allowed, one blocked
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('BLOCKED_COUNTRY');
    });

    it('should block when MAJORITY of countries are blocked (MAJORITY mode, 3+ countries)', () => {
      const policy = createPolicy({
        blockedCountryMode: 'MAJORITY',
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['RU', 'CN', 'US'], // 2 blocked, 1 allowed = majority blocked
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('BLOCKED_COUNTRY');
    });

    it('should NOT block when minority of countries are blocked (MAJORITY mode, 3+ countries)', () => {
      const policy = createPolicy({
        blockedCountryMode: 'MAJORITY',
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['US', 'GB', 'RU'], // 2 allowed, 1 blocked = minority blocked
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.reasons).toContain('ALLOWED_COUNTRY');
    });

    it('should use tie-breaker for 1-2 countries in MAJORITY mode (fallback to ANY)', () => {
      const policy = createPolicy({
        blockedCountryMode: 'MAJORITY',
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['RU', 'US'], // 1 blocked, 1 allowed = tie
        },
      });

      const result = evaluateEligibility(input, policy);

      // Tie-breaker: fallback to ANY mode = blocked
      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('BLOCKED_COUNTRY');
    });

    it('should block single blocked country in MAJORITY mode (tie-breaker)', () => {
      const policy = createPolicy({
        blockedCountryMode: 'MAJORITY',
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['RU'], // Single blocked country
        },
      });

      const result = evaluateEligibility(input, policy);

      // Tie-breaker: fallback to ANY mode = blocked
      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('BLOCKED_COUNTRY');
    });
  });

  describe('evaluateEligibility - Breakout Overrides Blocked', () => {
    it('should return ELIGIBLE when blocked country matches breakout rule', () => {
      const policy = createPolicy({
        breakoutRules: [
          {
            id: 'global-hit',
            name: 'Global Hit',
            priority: 1,
            requirements: {
              minImdbVotes: 50000,
            },
          },
        ],
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['RU'], // Blocked
          voteCountImdb: 100000, // Meets breakout requirement
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.reasons).toEqual(['BREAKOUT_ALLOWED']);
      expect(result.breakoutRuleId).toBe('global-hit');
    });

    it('should return ELIGIBLE when blocked language matches breakout rule', () => {
      const policy = createPolicy({
        breakoutRules: [
          {
            id: 'quality-content',
            name: 'Quality Content',
            priority: 1,
            requirements: {
              minQualityScoreNormalized: 0.7,
            },
          },
        ],
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originalLanguage: 'ru', // Blocked
        },
        stats: {
          qualityScore: 0.8, // Meets breakout requirement
          popularityScore: null,
          freshnessScore: null,
          ratingoScore: null,
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.reasons).toEqual(['BREAKOUT_ALLOWED']);
      expect(result.breakoutRuleId).toBe('quality-content');
    });

    it('should use first matching breakout rule by priority', () => {
      const policy = createPolicy({
        breakoutRules: [
          {
            id: 'high-priority',
            name: 'High Priority',
            priority: 1,
            requirements: {
              minImdbVotes: 50000,
            },
          },
          {
            id: 'low-priority',
            name: 'Low Priority',
            priority: 2,
            requirements: {
              minImdbVotes: 10000,
            },
          },
        ],
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['RU'],
          voteCountImdb: 60000, // Meets both rules
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.breakoutRuleId).toBe('high-priority');
    });

    it('should NOT apply breakout when requirements are not met', () => {
      const policy = createPolicy({
        breakoutRules: [
          {
            id: 'global-hit',
            name: 'Global Hit',
            priority: 1,
            requirements: {
              minImdbVotes: 50000,
            },
          },
        ],
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['RU'],
          voteCountImdb: 10000, // Does NOT meet requirement
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('BLOCKED_COUNTRY');
      expect(result.breakoutRuleId).toBeNull();
    });

    it('should check multiple breakout requirements (all must pass)', () => {
      const policy = createPolicy({
        breakoutRules: [
          {
            id: 'premium-content',
            name: 'Premium Content',
            priority: 1,
            requirements: {
              minImdbVotes: 50000,
              minQualityScoreNormalized: 0.7,
            },
          },
        ],
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['RU'],
          voteCountImdb: 60000, // Meets first requirement
        },
        stats: {
          qualityScore: 0.5, // Does NOT meet second requirement
          popularityScore: null,
          freshnessScore: null,
          ratingoScore: null,
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('BLOCKED_COUNTRY');
      expect(result.breakoutRuleId).toBeNull();
    });

    it('should match breakout rule when media has ANY of required originCountries', () => {
      const policy = createPolicy({
        breakoutRules: [
          {
            id: 'ukrainian-content',
            name: 'Ukrainian Content',
            priority: 1,
            requirements: {
              minImdbVotes: 200,
              originCountries: ['UA'],
            },
          },
        ],
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['RU', 'UA'], // Co-production with UA
          voteCountImdb: 500,
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.breakoutRuleId).toBe('ukrainian-content');
    });

    it('should NOT match breakout rule when media has NONE of required originCountries', () => {
      const policy = createPolicy({
        breakoutRules: [
          {
            id: 'ukrainian-content',
            name: 'Ukrainian Content',
            priority: 1,
            requirements: {
              minImdbVotes: 200,
              originCountries: ['UA'],
            },
          },
        ],
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['RU'], // Blocked, no UA
          voteCountImdb: 500,
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('BLOCKED_COUNTRY');
      expect(result.breakoutRuleId).toBeNull();
    });

    it('should NOT match breakout rule when media originCountries is empty', () => {
      const policy = createPolicy({
        breakoutRules: [
          {
            id: 'ukrainian-content',
            name: 'Ukrainian Content',
            priority: 1,
            requirements: {
              originCountries: ['UA'],
            },
          },
        ],
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['RU'], // Blocked
        },
      });

      const result = evaluateEligibility(input, policy);

      // Breakout doesn't match (no UA), so blocked country applies
      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.breakoutRuleId).toBeNull();
    });

    it('should match breakout rule with multiple required originCountries (ANY match)', () => {
      const policy = createPolicy({
        breakoutRules: [
          {
            id: 'eastern-european',
            name: 'Eastern European Content',
            priority: 1,
            requirements: {
              originCountries: ['UA', 'PL', 'CZ'],
            },
          },
        ],
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['RU', 'PL'], // Blocked RU, but has PL from requirements
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.breakoutRuleId).toBe('eastern-european');
    });
  });

  describe('evaluateEligibility - Neutral Returns INELIGIBLE', () => {
    it('should return INELIGIBLE when country is neutral (STRICT mode)', () => {
      const policy = createPolicy({
        eligibilityMode: 'STRICT',
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['FR'], // Not in allowed or blocked
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('NEUTRAL_COUNTRY');
    });

    it('should return INELIGIBLE when language is neutral (STRICT mode)', () => {
      const policy = createPolicy({
        eligibilityMode: 'STRICT',
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originalLanguage: 'fr', // Not in allowed or blocked
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('NEUTRAL_LANGUAGE');
    });

    it('should return ELIGIBLE when country is allowed but language is neutral (RELAXED mode)', () => {
      const policy = createPolicy({
        eligibilityMode: 'RELAXED',
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['US'], // Allowed
          originalLanguage: 'fr', // Neutral
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.reasons).toContain('ALLOWED_COUNTRY');
      expect(result.reasons).not.toContain('ALLOWED_LANGUAGE'); // Only country is allowed
      expect(result.reasons).not.toContain('NEUTRAL_COUNTRY');
      expect(result.reasons).not.toContain('NEUTRAL_LANGUAGE');
    });

    it('should return ELIGIBLE with ALLOWED_LANGUAGE when language is allowed but country is neutral (RELAXED mode)', () => {
      const policy = createPolicy({
        eligibilityMode: 'RELAXED',
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['FR'], // Neutral
          originalLanguage: 'en', // Allowed
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.reasons).toContain('ALLOWED_LANGUAGE');
      expect(result.reasons).not.toContain('ALLOWED_COUNTRY'); // Only language is allowed
      expect(result.reasons).not.toContain('NEUTRAL_COUNTRY');
      expect(result.reasons).not.toContain('NEUTRAL_LANGUAGE');
    });

    it('should return ELIGIBLE with both reasons when country AND language are allowed (RELAXED mode)', () => {
      const policy = createPolicy({
        eligibilityMode: 'RELAXED',
        allowedCountries: ['US', 'FR'],
        allowedLanguages: ['en', 'fr'],
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['FR'], // Allowed
          originalLanguage: 'fr', // Allowed (but would be neutral in default policy)
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.reasons).toContain('ALLOWED_COUNTRY');
      expect(result.reasons).toContain('ALLOWED_LANGUAGE');
    });

    it('should return INELIGIBLE when both country and language are neutral (RELAXED mode)', () => {
      const policy = createPolicy({
        eligibilityMode: 'RELAXED',
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['FR'], // Neutral
          originalLanguage: 'fr', // Neutral
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('NEUTRAL_COUNTRY');
      expect(result.reasons).toContain('NEUTRAL_LANGUAGE');
    });
  });

  describe('evaluateEligibility - Allowed Content', () => {
    it('should return ELIGIBLE when country and language are allowed', () => {
      const policy = createPolicy();
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['US'],
          originalLanguage: 'en',
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.reasons).toContain('ALLOWED_COUNTRY');
      expect(result.reasons).toContain('ALLOWED_LANGUAGE');
      expect(result.breakoutRuleId).toBeNull();
    });

    it('should return ELIGIBLE when all countries are allowed', () => {
      const policy = createPolicy();
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['US', 'GB', 'CA'], // All allowed
          originalLanguage: 'en',
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.reasons).toContain('ALLOWED_COUNTRY');
      expect(result.reasons).toContain('ALLOWED_LANGUAGE');
    });
  });

  describe('evaluateEligibility - Global Quality Gate', () => {
    it('should return INELIGIBLE with BLOCKED reason when blocked content fails global gate (breakout not attempted)', () => {
      // This is a critical business invariant:
      // Blocked content that fails global gate should return BLOCKED reason
      // and NOT attempt breakout evaluation
      const policy = createPolicy({
        blockedCountries: ['RU'],
        globalRequirements: {
          minVotesAnyOf: { sources: ['imdb'], min: 50000 },
        },
        breakoutRules: [
          {
            id: 'global-hit',
            name: 'Global Hit',
            priority: 1,
            requirements: {
              minImdbVotes: 10000, // Lower threshold - would match if evaluated
            },
          },
        ],
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['RU'], // Blocked
          voteCountImdb: 20000, // Meets breakout (10k) but NOT global gate (50k)
        },
      });

      const result = evaluateEligibility(input, policy);

      // Should be INELIGIBLE with BLOCKED_COUNTRY reason
      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('BLOCKED_COUNTRY');
      expect(result.reasons).not.toContain('MISSING_GLOBAL_SIGNALS');

      // Breakout should NOT be applied (not attempted)
      expect(result.breakoutRuleId).toBeNull();

      // Should include globalGateDetails showing which checks failed
      expect(result.globalGateDetails).toBeDefined();
      expect(result.globalGateDetails?.failedChecks).toContain('minVotesAnyOf');
    });

    it('should return INELIGIBLE with MISSING_GLOBAL_SIGNALS when non-blocked content fails global gate', () => {
      const policy = createPolicy({
        globalRequirements: {
          minVotesAnyOf: { sources: ['imdb'], min: 50000 },
        },
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['US'], // Allowed
          originalLanguage: 'en', // Allowed
          voteCountImdb: 10000, // Does NOT meet global gate
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('MISSING_GLOBAL_SIGNALS');
      expect(result.breakoutRuleId).toBeNull();
      expect(result.globalGateDetails).toBeDefined();
      expect(result.globalGateDetails?.failedChecks).toContain('minVotesAnyOf');
    });

    it('should allow breakout when blocked content passes global gate', () => {
      const policy = createPolicy({
        blockedCountries: ['RU'],
        globalRequirements: {
          minVotesAnyOf: { sources: ['imdb'], min: 10000 },
        },
        breakoutRules: [
          {
            id: 'global-hit',
            name: 'Global Hit',
            priority: 1,
            requirements: {
              minImdbVotes: 50000,
            },
          },
        ],
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['RU'], // Blocked
          voteCountImdb: 60000, // Meets both global gate (10k) AND breakout (50k)
        },
      });

      const result = evaluateEligibility(input, policy);

      // Should be ELIGIBLE via breakout (gate passed)
      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.reasons).toEqual(['BREAKOUT_ALLOWED']);
      expect(result.breakoutRuleId).toBe('global-hit');
      expect(result.globalGateDetails).toBeUndefined();
    });

    it('should skip global gate when not configured (backward compatibility)', () => {
      const policy = createPolicy({
        // No globalRequirements configured
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['US'],
          originalLanguage: 'en',
          voteCountImdb: 0, // Would fail gate if configured
        },
      });

      const result = evaluateEligibility(input, policy);

      // Should be ELIGIBLE (gate skipped)
      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.reasons).toContain('ALLOWED_COUNTRY');
      expect(result.globalGateDetails).toBeUndefined();
    });
  });

  describe('computeRelevance', () => {
    it('should return 0 when stats is null', () => {
      const policy = createPolicy();
      const input = createInput({
        stats: null,
      });

      const result = computeRelevance(input, policy);

      expect(result).toBe(0);
    });

    it('should return 0 when all scores are null', () => {
      const policy = createPolicy();
      const input = createInput({
        stats: {
          qualityScore: null,
          popularityScore: null,
          freshnessScore: null,
          ratingoScore: null,
        },
      });

      const result = computeRelevance(input, policy);

      expect(result).toBe(0);
    });

    it('should compute weighted average correctly', () => {
      const policy = createPolicy();
      const input = createInput({
        stats: {
          qualityScore: 0.8, // 40% weight
          popularityScore: 0.6, // 40% weight
          freshnessScore: 0.5, // 20% weight
          ratingoScore: null,
        },
      });

      // Expected: 0.8 * 0.4 + 0.6 * 0.4 + 0.5 * 0.2 = 0.32 + 0.24 + 0.1 = 0.66
      // Scaled to 0-100: 66
      const result = computeRelevance(input, policy);

      expect(result).toBe(66);
    });

    it('should handle missing individual scores as 0', () => {
      const policy = createPolicy();
      const input = createInput({
        stats: {
          qualityScore: 1.0,
          popularityScore: null, // Missing
          freshnessScore: null, // Missing
          ratingoScore: null,
        },
      });

      // Expected: 1.0 * 0.4 + 0 * 0.4 + 0 * 0.2 = 0.4
      // Scaled to 0-100: 40
      const result = computeRelevance(input, policy);

      expect(result).toBe(40);
    });

    it('should return value in range [0, 100]', () => {
      const policy = createPolicy();
      const input = createInput({
        stats: {
          qualityScore: 1.0,
          popularityScore: 1.0,
          freshnessScore: 1.0,
          ratingoScore: null,
        },
      });

      const result = computeRelevance(input, policy);

      expect(result).toBe(100);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });
  });

  describe('shouldApplyGlobalGate', () => {
    it('should return false when requirements is undefined', () => {
      const result = shouldApplyGlobalGate(undefined, 'catalog');
      expect(result).toBe(false);
    });

    it('should use default contexts when appliesTo is not configured', () => {
      const requirements: GlobalRequirements = {
        minVotesAnyOf: { sources: ['imdb'], min: 1000 },
      };

      // Default contexts: catalog, homepage, trending, search
      expect(shouldApplyGlobalGate(requirements, 'catalog')).toBe(true);
      expect(shouldApplyGlobalGate(requirements, 'homepage')).toBe(true);
      expect(shouldApplyGlobalGate(requirements, 'trending')).toBe(true);
      expect(shouldApplyGlobalGate(requirements, 'search')).toBe(true);

      // Freshness contexts NOT in default
      expect(shouldApplyGlobalGate(requirements, 'now_playing')).toBe(false);
      expect(shouldApplyGlobalGate(requirements, 'new_digital')).toBe(false);
    });

    it('should respect appliesTo configuration', () => {
      const requirements: GlobalRequirements = {
        minVotesAnyOf: { sources: ['imdb'], min: 1000 },
        appliesTo: ['catalog', 'homepage'],
      };

      expect(shouldApplyGlobalGate(requirements, 'catalog')).toBe(true);
      expect(shouldApplyGlobalGate(requirements, 'homepage')).toBe(true);
      expect(shouldApplyGlobalGate(requirements, 'trending')).toBe(false);
      expect(shouldApplyGlobalGate(requirements, 'search')).toBe(false);
      expect(shouldApplyGlobalGate(requirements, 'now_playing')).toBe(false);
    });

    it('should return false for all contexts when appliesTo is empty array', () => {
      const requirements: GlobalRequirements = {
        minVotesAnyOf: { sources: ['imdb'], min: 1000 },
        appliesTo: [],
      };

      expect(shouldApplyGlobalGate(requirements, 'catalog')).toBe(false);
      expect(shouldApplyGlobalGate(requirements, 'homepage')).toBe(false);
      expect(shouldApplyGlobalGate(requirements, 'now_playing')).toBe(false);
    });

    it('should default to catalog context when not provided', () => {
      const requirements: GlobalRequirements = {
        minVotesAnyOf: { sources: ['imdb'], min: 1000 },
        appliesTo: ['catalog'],
      };

      expect(shouldApplyGlobalGate(requirements)).toBe(true);
    });
  });

  describe('evaluateEligibility - Context-Aware Gate', () => {
    it('should produce same result with no options as with context=catalog (Property 1)', () => {
      const policy = createPolicy({
        globalRequirements: {
          minVotesAnyOf: { sources: ['imdb'], min: 50000 },
        },
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['US'],
          originalLanguage: 'en',
          voteCountImdb: 10000, // Fails gate
        },
      });

      const resultNoOptions = evaluateEligibility(input, policy);
      const resultCatalog = evaluateEligibility(input, policy, { context: 'catalog' });

      expect(resultNoOptions.status).toBe(resultCatalog.status);
      expect(resultNoOptions.reasons).toEqual(resultCatalog.reasons);
    });

    it('should skip gate for now_playing context when not in appliesTo (Property 2)', () => {
      const policy = createPolicy({
        globalRequirements: {
          minVotesAnyOf: { sources: ['imdb'], min: 50000 },
          // Default appliesTo: catalog, homepage, trending, search
        },
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['US'],
          originalLanguage: 'en',
          voteCountImdb: 100, // Would fail gate
        },
      });

      // Catalog context - gate applies, should fail
      const catalogResult = evaluateEligibility(input, policy, { context: 'catalog' });
      expect(catalogResult.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(catalogResult.reasons).toContain('MISSING_GLOBAL_SIGNALS');

      // Now playing context - gate skipped, should pass
      const nowPlayingResult = evaluateEligibility(input, policy, { context: 'now_playing' });
      expect(nowPlayingResult.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(nowPlayingResult.reasons).toContain('ALLOWED_COUNTRY');
    });

    it('should apply gate when context is in appliesTo', () => {
      const policy = createPolicy({
        globalRequirements: {
          minVotesAnyOf: { sources: ['imdb'], min: 50000 },
          appliesTo: ['catalog', 'now_playing'], // Explicitly include now_playing
        },
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['US'],
          originalLanguage: 'en',
          voteCountImdb: 100, // Fails gate
        },
      });

      // Now playing context - gate applies because explicitly in appliesTo
      const result = evaluateEligibility(input, policy, { context: 'now_playing' });
      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('MISSING_GLOBAL_SIGNALS');
    });

    it('should set reasons to exactly [MISSING_GLOBAL_SIGNALS] when gate fails (Property 6)', () => {
      const policy = createPolicy({
        globalRequirements: {
          minVotesAnyOf: { sources: ['imdb'], min: 50000 },
          minQualityScoreNormalized: 0.5,
        },
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['US'],
          originalLanguage: 'en',
          voteCountImdb: 100, // Fails minVotesAnyOf
        },
        stats: {
          qualityScore: 0.1, // Fails minQualityScoreNormalized
          popularityScore: null,
          freshnessScore: null,
          ratingoScore: null,
        },
      });

      const result = evaluateEligibility(input, policy, { context: 'catalog' });

      // Contract: reasons must be exactly ['MISSING_GLOBAL_SIGNALS']
      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toEqual(['MISSING_GLOBAL_SIGNALS']);
      expect(result.reasons.length).toBe(1);

      // Diagnostics go to globalGateDetails only
      expect(result.globalGateDetails).toBeDefined();
      expect(result.globalGateDetails?.failedChecks).toContain('minVotesAnyOf');
      expect(result.globalGateDetails?.failedChecks).toContain('minQualityScoreNormalized');
    });

    it('should still block content regardless of context (hard blocks override)', () => {
      const policy = createPolicy({
        blockedCountries: ['RU'],
        globalRequirements: {
          minVotesAnyOf: { sources: ['imdb'], min: 50000 },
        },
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['RU'], // Blocked
          originalLanguage: 'en',
          voteCountImdb: 100000, // Passes gate
        },
      });

      // Even in now_playing context, blocked content stays blocked
      const result = evaluateEligibility(input, policy, { context: 'now_playing' });
      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('BLOCKED_COUNTRY');
    });

    it('should skip gate for trending context when appliesTo excludes trending', () => {
      const policy = createPolicy({
        globalRequirements: {
          minVotesAnyOf: { sources: ['imdb'], min: 50000 },
          appliesTo: [EvaluationContext.CATALOG, EvaluationContext.HOMEPAGE], // Excludes trending
        },
        // Disable overview requirement to focus on gate behavior
        contextRequirements: {
          trending: { requireOverview: false },
          homepage: { requireOverview: false },
        },
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['US'],
          originalLanguage: 'en',
          voteCountImdb: 100, // Would fail gate
        },
      });

      // Catalog context - gate applies, should fail
      const catalogResult = evaluateEligibility(input, policy, {
        context: EvaluationContext.CATALOG,
      });
      expect(catalogResult.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(catalogResult.reasons).toContain('MISSING_GLOBAL_SIGNALS');

      // Trending context - gate skipped, should pass
      const trendingResult = evaluateEligibility(input, policy, {
        context: EvaluationContext.TRENDING,
      });
      expect(trendingResult.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(trendingResult.reasons).toContain('ALLOWED_COUNTRY');
      expect(trendingResult.reasons).toContain('ALLOWED_LANGUAGE');
    });

    it('should allow same media item to be INELIGIBLE for catalog but ELIGIBLE for trending', () => {
      // This is the key business scenario: trending surface has relaxed requirements
      const policy = createPolicy({
        globalRequirements: {
          minVotesAnyOf: { sources: ['imdb'], min: 50000 },
          appliesTo: [EvaluationContext.CATALOG], // Only catalog requires gate
        },
        // Disable overview requirement to focus on gate behavior
        contextRequirements: {
          trending: { requireOverview: false },
        },
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['US'],
          originalLanguage: 'en',
          voteCountImdb: 1000, // Low votes - fails catalog gate
        },
      });

      const catalogResult = evaluateEligibility(input, policy, {
        context: EvaluationContext.CATALOG,
      });
      const trendingResult = evaluateEligibility(input, policy, {
        context: EvaluationContext.TRENDING,
      });

      // Same input, different outcomes based on context
      expect(catalogResult.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(trendingResult.status).toBe(EligibilityStatus.ELIGIBLE);
    });

    it('should apply gate for trending when trending is in appliesTo', () => {
      const policy = createPolicy({
        globalRequirements: {
          minVotesAnyOf: { sources: ['imdb'], min: 50000 },
          appliesTo: [EvaluationContext.CATALOG, EvaluationContext.TRENDING], // Includes trending
        },
        // Disable overview requirement to focus on gate behavior
        contextRequirements: {
          trending: { requireOverview: false },
        },
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['US'],
          originalLanguage: 'en',
          voteCountImdb: 100, // Fails gate
        },
      });

      const trendingResult = evaluateEligibility(input, policy, {
        context: EvaluationContext.TRENDING,
      });
      expect(trendingResult.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(trendingResult.reasons).toContain('MISSING_GLOBAL_SIGNALS');
    });

    it('should use EvaluationContext constants for context values', () => {
      const policy = createPolicy({
        globalRequirements: {
          minVotesAnyOf: { sources: ['imdb'], min: 50000 },
          appliesTo: [EvaluationContext.CATALOG],
        },
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: ['US'],
          originalLanguage: 'en',
          voteCountImdb: 100,
        },
      });

      // Verify all context constants work correctly
      const contexts = [
        EvaluationContext.CATALOG,
        EvaluationContext.TRENDING,
        EvaluationContext.HOMEPAGE,
        EvaluationContext.NOW_PLAYING,
        EvaluationContext.NEW_DIGITAL,
        EvaluationContext.SEARCH,
      ];

      for (const context of contexts) {
        const result = evaluateEligibility(input, policy, { context });
        // Should not throw, context is valid
        expect(result.status).toBeDefined();
      }
    });
  });

  describe('checkContentClassExcluded', () => {
    it('should return false when excludedClasses is undefined', () => {
      expect(checkContentClassExcluded('anime', undefined)).toBe(false);
    });

    it('should return false when excludedClasses is empty array', () => {
      expect(checkContentClassExcluded('anime', [])).toBe(false);
    });

    it('should return true when content class is in excluded list', () => {
      expect(checkContentClassExcluded('anime', ['anime', 'reality'])).toBe(true);
    });

    it('should return false when content class is not in excluded list', () => {
      expect(checkContentClassExcluded('mainstream', ['anime', 'reality'])).toBe(false);
    });
  });

  describe('evaluateEligibility - Content Class Exclusion', () => {
    it('should return INELIGIBLE when content class is excluded without breakout', () => {
      const policy = createPolicy({
        excludedContentClasses: ['anime'],
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          contentClass: 'anime',
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('EXCLUDED_CONTENT_CLASS');
      expect(result.breakoutRuleId).toBeNull();
    });

    it('should return ELIGIBLE when content class is not excluded', () => {
      const policy = createPolicy({
        excludedContentClasses: ['anime'],
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          contentClass: 'mainstream',
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.reasons).not.toContain('EXCLUDED_CONTENT_CLASS');
    });

    it('should return ELIGIBLE when excludedContentClasses is not configured', () => {
      const policy = createPolicy();
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          contentClass: 'anime',
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.reasons).not.toContain('EXCLUDED_CONTENT_CLASS');
    });

    it('should allow breakout to override content class exclusion (SOFT filter)', () => {
      const policy = createPolicy({
        excludedContentClasses: ['anime'],
        breakoutRules: [
          {
            id: 'anime-global-hit',
            name: 'Anime Global Hit',
            priority: 10,
            requirements: {
              minImdbVotes: 50000,
            },
          },
        ],
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          contentClass: 'anime',
          voteCountImdb: 100000, // Meets breakout requirement
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.reasons).toContain('EXCLUDED_CONTENT_CLASS');
      expect(result.reasons).toContain('BREAKOUT_ALLOWED');
      expect(result.breakoutRuleId).toBe('anime-global-hit');
    });

    it('should NOT allow breakout to override hard blocks (BLOCKED_COUNTRY)', () => {
      const policy = createPolicy({
        excludedContentClasses: ['anime'],
        blockedCountries: ['RU'],
        breakoutRules: [
          {
            id: 'anime-global-hit',
            name: 'Anime Global Hit',
            priority: 10,
            requirements: {
              minImdbVotes: 50000,
            },
          },
        ],
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          contentClass: 'anime',
          originCountries: ['RU'], // Hard blocked
          voteCountImdb: 100000, // Meets breakout requirement
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('EXCLUDED_CONTENT_CLASS');
      expect(result.reasons).toContain('BLOCKED_COUNTRY');
      expect(result.breakoutRuleId).toBeNull();
    });

    it('should return INELIGIBLE for missing data regardless of content class exclusion', () => {
      // Per Readability & Pending Reform: missing data returns INELIGIBLE with umbrella + specific reasons
      const policy = createPolicy({
        excludedContentClasses: ['anime'],
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          contentClass: 'anime',
          originCountries: null, // Missing data
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('MISSING_REQUIRED_METADATA');
      expect(result.reasons).toContain('MISSING_ORIGIN_COUNTRY');
      expect(result.reasons).not.toContain('EXCLUDED_CONTENT_CLASS');
    });

    it('should check global gate before allowing breakout for excluded content', () => {
      const policy = createPolicy({
        excludedContentClasses: ['anime'],
        globalRequirements: {
          minVotesAnyOf: { sources: ['imdb'], min: 100000 },
        },
        breakoutRules: [
          {
            id: 'anime-global-hit',
            name: 'Anime Global Hit',
            priority: 10,
            requirements: {
              minImdbVotes: 50000, // Lower than global gate
            },
          },
        ],
      });
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          contentClass: 'anime',
          voteCountImdb: 60000, // Meets breakout but NOT global gate
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain('EXCLUDED_CONTENT_CLASS');
      expect(result.globalGateDetails).toBeDefined();
      expect(result.globalGateDetails?.failedChecks).toContain('minVotesAnyOf');
    });

    it('should exclude multiple content classes', () => {
      const policy = createPolicy({
        excludedContentClasses: ['anime', 'reality', 'kids'],
      });

      const animeInput = createInput({
        mediaItem: { ...createInput().mediaItem, contentClass: 'anime' },
      });
      const realityInput = createInput({
        mediaItem: { ...createInput().mediaItem, contentClass: 'reality' },
      });
      const kidsInput = createInput({
        mediaItem: { ...createInput().mediaItem, contentClass: 'kids' },
      });
      const mainstreamInput = createInput({
        mediaItem: { ...createInput().mediaItem, contentClass: 'mainstream' },
      });
      const documentaryInput = createInput({
        mediaItem: { ...createInput().mediaItem, contentClass: 'documentary' },
      });

      expect(evaluateEligibility(animeInput, policy).status).toBe(EligibilityStatus.INELIGIBLE);
      expect(evaluateEligibility(realityInput, policy).status).toBe(EligibilityStatus.INELIGIBLE);
      expect(evaluateEligibility(kidsInput, policy).status).toBe(EligibilityStatus.INELIGIBLE);
      expect(evaluateEligibility(mainstreamInput, policy).status).toBe(EligibilityStatus.ELIGIBLE);
      expect(evaluateEligibility(documentaryInput, policy).status).toBe(EligibilityStatus.ELIGIBLE);
    });
  });
});
