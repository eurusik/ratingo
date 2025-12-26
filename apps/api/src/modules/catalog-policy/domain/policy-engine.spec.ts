/**
 * Policy Engine Unit Tests
 *
 * Tests for the core policy engine pure functions.
 * Focus on explicit test cases for readability and edge case coverage.
 */

import { evaluateEligibility, computeRelevance } from './policy-engine';
import { PolicyConfig, PolicyEngineInput } from './types/policy.types';
import { EligibilityStatus } from './constants/evaluation.constants';

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
      watchProviders: null,
      voteCountImdb: null,
      voteCountTrakt: null,
      ratingImdb: null,
      ratingMetacritic: null,
      ratingRottenTomatoes: null,
      ratingTrakt: null,
    },
    stats: null,
    ...overrides,
  });

  describe('evaluateEligibility - Missing Data Returns PENDING', () => {
    it('should return PENDING when originCountries is null', () => {
      const policy = createPolicy();
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: null,
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.PENDING);
      expect(result.reasons).toContain('MISSING_ORIGIN_COUNTRY');
      expect(result.breakoutRuleId).toBeNull();
    });

    it('should return PENDING when originCountries is empty array', () => {
      const policy = createPolicy();
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: [],
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.PENDING);
      expect(result.reasons).toContain('MISSING_ORIGIN_COUNTRY');
      expect(result.breakoutRuleId).toBeNull();
    });

    it('should return PENDING when originalLanguage is null', () => {
      const policy = createPolicy();
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originalLanguage: null,
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.PENDING);
      expect(result.reasons).toContain('MISSING_ORIGINAL_LANGUAGE');
      expect(result.breakoutRuleId).toBeNull();
    });

    it('should return PENDING when originalLanguage is empty string', () => {
      const policy = createPolicy();
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originalLanguage: '',
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.PENDING);
      expect(result.reasons).toContain('MISSING_ORIGINAL_LANGUAGE');
      expect(result.breakoutRuleId).toBeNull();
    });

    it('should return PENDING when both originCountries and originalLanguage are missing', () => {
      const policy = createPolicy();
      const input = createInput({
        mediaItem: {
          ...createInput().mediaItem,
          originCountries: null,
          originalLanguage: null,
        },
      });

      const result = evaluateEligibility(input, policy);

      expect(result.status).toBe(EligibilityStatus.PENDING);
      // Should return on first missing check (originCountries)
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

      expect(result.status).toBe(EligibilityStatus.PENDING);
      expect(result.reasons).toEqual(['MISSING_ORIGIN_COUNTRY']);
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
});
