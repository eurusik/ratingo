import { BlockedCountryMode, EligibilityMode } from '../types/policy.types';
import type { BreakoutRule, PolicyConfig, PolicyEngineInput } from '../types/policy.types';
import { matchesBreakoutRule, findMatchingBreakoutRule } from './breakout-rule.evaluator';

describe('BreakoutRuleEvaluator', () => {
  const createMediaItem = (
    overrides: Partial<PolicyEngineInput['mediaItem']> = {},
  ): PolicyEngineInput['mediaItem'] => ({
    id: 'test-id',
    originCountries: ['US'],
    originalLanguage: 'en',
    title: 'Test Movie',
    overview: 'Test overview',
    contentClass: 'mainstream',
    normalizedOffers: [],
    voteCountImdb: null,
    voteCountTrakt: null,
    ratingImdb: null,
    ratingMetacritic: null,
    ratingRottenTomatoes: null,
    ratingTrakt: null,
    ...overrides,
  });

  const createInput = (
    mediaOverrides: Partial<PolicyEngineInput['mediaItem']> = {},
    stats: PolicyEngineInput['stats'] = null,
  ): PolicyEngineInput => ({
    mediaItem: createMediaItem(mediaOverrides),
    stats,
  });

  const createPolicy = (breakoutRules: BreakoutRule[] = []): PolicyConfig => ({
    allowedCountries: ['US'],
    blockedCountries: [],
    blockedCountryMode: BlockedCountryMode.ANY,
    allowedLanguages: ['en'],
    blockedLanguages: [],
    globalProviders: [],
    breakoutRules,
    eligibilityMode: EligibilityMode.STRICT,
    homepage: { minRelevanceScore: 50 },
  });

  describe('matchesBreakoutRule', () => {
    it('should match when rule has no requirements', () => {
      const rule: BreakoutRule = {
        id: 'rule-1',
        name: 'Rule 1',
        priority: 1,
        requirements: {},
      };

      expect(matchesBreakoutRule(createInput(), rule)).toBe(true);
    });

    it('should not match when excludeOriginCountries requirement fails', () => {
      const rule: BreakoutRule = {
        id: 'rule-1',
        name: 'Rule 1',
        priority: 1,
        requirements: { excludeOriginCountries: ['US'] },
      };

      expect(matchesBreakoutRule(createInput({ originCountries: ['US'] }), rule)).toBe(false);
    });

    it('should match when excludeOriginCountries requirement passes', () => {
      const rule: BreakoutRule = {
        id: 'rule-1',
        name: 'Rule 1',
        priority: 1,
        requirements: { excludeOriginCountries: ['RU'] },
      };

      expect(matchesBreakoutRule(createInput({ originCountries: ['US'] }), rule)).toBe(true);
    });

    it('should not match when originCountries requirement fails', () => {
      const rule: BreakoutRule = {
        id: 'rule-1',
        name: 'Rule 1',
        priority: 1,
        requirements: { originCountries: ['GB'] },
      };

      expect(matchesBreakoutRule(createInput({ originCountries: ['US'] }), rule)).toBe(false);
    });

    it('should not match when minImdbVotes requirement fails', () => {
      const rule: BreakoutRule = {
        id: 'rule-1',
        name: 'Rule 1',
        priority: 1,
        requirements: { minImdbVotes: 10000 },
      };

      expect(matchesBreakoutRule(createInput({ voteCountImdb: 5000 }), rule)).toBe(false);
    });

    it('should match when minImdbVotes requirement passes', () => {
      const rule: BreakoutRule = {
        id: 'rule-1',
        name: 'Rule 1',
        priority: 1,
        requirements: { minImdbVotes: 5000 },
      };

      expect(matchesBreakoutRule(createInput({ voteCountImdb: 10000 }), rule)).toBe(true);
    });

    it('should not match when minTraktVotes requirement fails', () => {
      const rule: BreakoutRule = {
        id: 'rule-1',
        name: 'Rule 1',
        priority: 1,
        requirements: { minTraktVotes: 1000 },
      };

      expect(matchesBreakoutRule(createInput({ voteCountTrakt: 500 }), rule)).toBe(false);
    });

    it('should not match when minQualityScoreNormalized requirement fails', () => {
      const rule: BreakoutRule = {
        id: 'rule-1',
        name: 'Rule 1',
        priority: 1,
        requirements: { minQualityScoreNormalized: 0.5 },
      };
      const input = createInput(
        {},
        { qualityScore: 0.3, popularityScore: 0.5, freshnessScore: 0.3, ratingoScore: 30 },
      );

      expect(matchesBreakoutRule(input, rule)).toBe(false);
    });

    it('should match when all requirements pass', () => {
      const rule: BreakoutRule = {
        id: 'rule-1',
        name: 'Rule 1',
        priority: 1,
        requirements: {
          originCountries: ['US', 'GB'],
          excludeOriginCountries: ['RU'],
          minImdbVotes: 5000,
          minQualityScoreNormalized: 0.5,
        },
      };
      const input = createInput(
        { originCountries: ['US'], voteCountImdb: 10000 },
        { qualityScore: 0.7, popularityScore: 0.5, freshnessScore: 0.3, ratingoScore: 70 },
      );

      expect(matchesBreakoutRule(input, rule)).toBe(true);
    });
  });

  describe('findMatchingBreakoutRule', () => {
    it('should return null when no breakout rules configured', () => {
      expect(findMatchingBreakoutRule(createInput(), createPolicy([]))).toBeNull();
    });

    it('should return null when no rules match', () => {
      const rules: BreakoutRule[] = [
        { id: 'rule-1', name: 'Rule 1', priority: 1, requirements: { minImdbVotes: 100000 } },
        { id: 'rule-2', name: 'Rule 2', priority: 2, requirements: { originCountries: ['JP'] } },
      ];

      expect(
        findMatchingBreakoutRule(createInput({ voteCountImdb: 1000 }), createPolicy(rules)),
      ).toBeNull();
    });

    it('should return first matching rule', () => {
      const rules: BreakoutRule[] = [
        { id: 'rule-1', name: 'Rule 1', priority: 1, requirements: {} },
        { id: 'rule-2', name: 'Rule 2', priority: 2, requirements: {} },
      ];

      const result = findMatchingBreakoutRule(createInput(), createPolicy(rules));

      expect(result?.id).toBe('rule-1');
    });

    it('should respect priority order (lowest priority number first)', () => {
      const rules: BreakoutRule[] = [
        { id: 'rule-2', name: 'Rule 2', priority: 2, requirements: {} },
        { id: 'rule-1', name: 'Rule 1', priority: 1, requirements: {} },
        { id: 'rule-3', name: 'Rule 3', priority: 3, requirements: {} },
      ];

      const result = findMatchingBreakoutRule(createInput(), createPolicy(rules));

      expect(result?.id).toBe('rule-1');
    });

    it('should return higher priority matching rule even if lower priority also matches', () => {
      const rules: BreakoutRule[] = [
        {
          id: 'strict-rule',
          name: 'Strict Rule',
          priority: 1,
          requirements: { minImdbVotes: 50000 },
        },
        { id: 'lenient-rule', name: 'Lenient Rule', priority: 2, requirements: {} },
      ];

      // Only lenient rule matches
      const result1 = findMatchingBreakoutRule(
        createInput({ voteCountImdb: 1000 }),
        createPolicy(rules),
      );
      expect(result1?.id).toBe('lenient-rule');

      // Both rules match, but strict has higher priority
      const result2 = findMatchingBreakoutRule(
        createInput({ voteCountImdb: 60000 }),
        createPolicy(rules),
      );
      expect(result2?.id).toBe('strict-rule');
    });
  });
});
