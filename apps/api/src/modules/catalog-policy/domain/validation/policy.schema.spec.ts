/**
 * Policy Schema Validation Tests
 *
 * Tests for validatePolicyOrThrow function including:
 * - Schema validation (structure, types)
 * - Normalization (country/language codes, sorting)
 * - Business rules (overlaps, duplicates)
 */

import { validatePolicyOrThrow, isPolicyConfig } from './policy.schema';
import { PolicyConfig } from '../types/policy.types';

describe('Policy Schema Validation', () => {
  // Helper to create a minimal valid policy
  const createValidPolicy = (overrides?: Partial<PolicyConfig>): unknown => ({
    allowedCountries: ['us', 'gb'],
    blockedCountries: ['ru'],
    blockedCountryMode: 'ANY',
    allowedLanguages: ['EN', 'UK'],
    blockedLanguages: ['ru'],
    globalProviders: ['Netflix'],
    breakoutRules: [
      {
        id: 'rule-1',
        name: 'Test Rule',
        priority: 1,
        requirements: { minImdbVotes: 10000 },
      },
    ],
    eligibilityMode: 'STRICT',
    homepage: { minRelevanceScore: 50 },
    ...overrides,
  });

  describe('validatePolicyOrThrow - Schema Validation', () => {
    it('should accept valid policy', () => {
      const policy = createValidPolicy();
      expect(() => validatePolicyOrThrow(policy)).not.toThrow();
    });

    it('should reject policy with missing required fields', () => {
      const policy = { allowedCountries: ['US'] };
      expect(() => validatePolicyOrThrow(policy)).toThrow();
    });

    it('should reject policy with invalid country code length', () => {
      const policy = createValidPolicy({ allowedCountries: ['USA'] });
      expect(() => validatePolicyOrThrow(policy)).toThrow(/2 characters/);
    });

    it('should reject policy with invalid language code length', () => {
      const policy = createValidPolicy({ allowedLanguages: ['ENG'] });
      expect(() => validatePolicyOrThrow(policy)).toThrow(/2 characters/);
    });

    it('should reject policy with invalid blockedCountryMode', () => {
      const policy = createValidPolicy({ blockedCountryMode: 'INVALID' as any });
      expect(() => validatePolicyOrThrow(policy)).toThrow();
    });

    it('should reject policy with invalid eligibilityMode', () => {
      const policy = createValidPolicy({ eligibilityMode: 'INVALID' as any });
      expect(() => validatePolicyOrThrow(policy)).toThrow();
    });

    it('should reject policy with negative minRelevanceScore', () => {
      const policy = createValidPolicy({ homepage: { minRelevanceScore: -10 } });
      expect(() => validatePolicyOrThrow(policy)).toThrow();
    });

    it('should reject policy with minRelevanceScore > 100', () => {
      const policy = createValidPolicy({ homepage: { minRelevanceScore: 150 } });
      expect(() => validatePolicyOrThrow(policy)).toThrow(/100/);
    });
  });

  describe('validatePolicyOrThrow - Breakout Rule Validation', () => {
    it('should reject breakout rule with empty id', () => {
      const policy = createValidPolicy({
        breakoutRules: [
          { id: '', name: 'Test', priority: 1, requirements: { minImdbVotes: 1000 } },
        ],
      });
      expect(() => validatePolicyOrThrow(policy)).toThrow(/required/i);
    });

    it('should reject breakout rule with empty name', () => {
      const policy = createValidPolicy({
        breakoutRules: [
          { id: 'rule-1', name: '', priority: 1, requirements: { minImdbVotes: 1000 } },
        ],
      });
      expect(() => validatePolicyOrThrow(policy)).toThrow(/required/i);
    });

    it('should reject breakout rule with negative priority', () => {
      const policy = createValidPolicy({
        breakoutRules: [
          { id: 'rule-1', name: 'Test', priority: -1, requirements: { minImdbVotes: 1000 } },
        ],
      });
      expect(() => validatePolicyOrThrow(policy)).toThrow(/non-negative/i);
    });

    it('should reject breakout rule with invalid rating source', () => {
      const policy = createValidPolicy({
        breakoutRules: [
          {
            id: 'rule-1',
            name: 'Test',
            priority: 1,
            requirements: { requireAnyOfRatingsPresent: ['invalid' as any] },
          },
        ],
      });
      expect(() => validatePolicyOrThrow(policy)).toThrow();
    });

    it('should reject breakout rule with minQualityScoreNormalized > 1', () => {
      const policy = createValidPolicy({
        breakoutRules: [
          {
            id: 'rule-1',
            name: 'Test',
            priority: 1,
            requirements: { minQualityScoreNormalized: 1.5 },
          },
        ],
      });
      expect(() => validatePolicyOrThrow(policy)).toThrow();
    });

    it('should reject breakout rule with minQualityScoreNormalized < 0', () => {
      const policy = createValidPolicy({
        breakoutRules: [
          {
            id: 'rule-1',
            name: 'Test',
            priority: 1,
            requirements: { minQualityScoreNormalized: -0.5 },
          },
        ],
      });
      expect(() => validatePolicyOrThrow(policy)).toThrow();
    });
  });

  describe('validatePolicyOrThrow - Normalization', () => {
    it('should uppercase country codes', () => {
      const policy = createValidPolicy({
        allowedCountries: ['us', 'gb'],
        blockedCountries: ['ru', 'cn'],
      });

      const result = validatePolicyOrThrow(policy);

      expect(result.allowedCountries).toEqual(['US', 'GB']);
      expect(result.blockedCountries).toEqual(['RU', 'CN']);
    });

    it('should lowercase language codes', () => {
      const policy = createValidPolicy({
        allowedLanguages: ['EN', 'UK'],
        blockedLanguages: ['RU'],
      });

      const result = validatePolicyOrThrow(policy);

      expect(result.allowedLanguages).toEqual(['en', 'uk']);
      expect(result.blockedLanguages).toEqual(['ru']);
    });

    it('should sort breakout rules by priority ascending', () => {
      const policy = createValidPolicy({
        breakoutRules: [
          { id: 'rule-3', name: 'Third', priority: 3, requirements: { minImdbVotes: 1000 } },
          { id: 'rule-1', name: 'First', priority: 1, requirements: { minImdbVotes: 1000 } },
          { id: 'rule-2', name: 'Second', priority: 2, requirements: { minImdbVotes: 1000 } },
        ],
      });

      const result = validatePolicyOrThrow(policy);

      expect(result.breakoutRules[0].id).toBe('rule-1');
      expect(result.breakoutRules[1].id).toBe('rule-2');
      expect(result.breakoutRules[2].id).toBe('rule-3');
    });
  });

  describe('validatePolicyOrThrow - Business Rules', () => {
    it('should reject overlapping allowed/blocked countries', () => {
      const policy = createValidPolicy({
        allowedCountries: ['us', 'gb', 'ru'],
        blockedCountries: ['ru', 'cn'],
      });

      expect(() => validatePolicyOrThrow(policy)).toThrow(/both allowed and blocked.*RU/i);
    });

    it('should reject overlapping allowed/blocked languages', () => {
      const policy = createValidPolicy({
        allowedLanguages: ['en', 'ru'],
        blockedLanguages: ['ru'],
      });

      expect(() => validatePolicyOrThrow(policy)).toThrow(/both allowed and blocked.*ru/i);
    });

    it('should reject duplicate breakout rule IDs', () => {
      const policy = createValidPolicy({
        breakoutRules: [
          { id: 'rule-1', name: 'First', priority: 1, requirements: { minImdbVotes: 1000 } },
          { id: 'rule-1', name: 'Duplicate', priority: 2, requirements: { minImdbVotes: 2000 } },
        ],
      });

      expect(() => validatePolicyOrThrow(policy)).toThrow(/unique/i);
    });

    it('should reject duplicate breakout rule priorities', () => {
      const policy = createValidPolicy({
        breakoutRules: [
          { id: 'rule-1', name: 'First', priority: 1, requirements: { minImdbVotes: 1000 } },
          { id: 'rule-2', name: 'Second', priority: 1, requirements: { minImdbVotes: 2000 } },
        ],
      });

      expect(() => validatePolicyOrThrow(policy)).toThrow(/priorities.*unique/i);
    });

    it('should reject breakout rule with no requirements', () => {
      const policy = createValidPolicy({
        breakoutRules: [{ id: 'rule-1', name: 'Empty', priority: 1, requirements: {} }],
      });

      expect(() => validatePolicyOrThrow(policy)).toThrow(/at least one requirement/i);
    });
  });

  describe('isPolicyConfig', () => {
    it('should return true for valid policy', () => {
      const policy = createValidPolicy();
      expect(isPolicyConfig(policy)).toBe(true);
    });

    it('should return false for invalid policy', () => {
      expect(isPolicyConfig({})).toBe(false);
      expect(isPolicyConfig(null)).toBe(false);
      expect(isPolicyConfig('string')).toBe(false);
    });
  });
});
