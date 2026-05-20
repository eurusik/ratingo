import * as fc from 'fast-check';

import { EligibilityStatus, EvaluationReason } from '../constants/evaluation.constants';
import { BlockedCountryMode, EligibilityMode } from '../types/policy.types';
import { checkBlocked, checkNeutral, tryRelaxedModeEligibility } from './country-language.gate';
import type { PolicyConfig, PolicyEngineInput } from '../types/policy.types';

describe('CountryLanguageGate', () => {
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

  const createPolicy = (overrides: Partial<PolicyConfig> = {}): PolicyConfig => ({
    allowedCountries: ['US', 'GB', 'UA'],
    blockedCountries: ['RU', 'BY'],
    blockedCountryMode: BlockedCountryMode.ANY,
    allowedLanguages: ['en', 'uk'],
    blockedLanguages: ['ru'],
    globalProviders: [],
    breakoutRules: [],
    eligibilityMode: EligibilityMode.STRICT,
    homepage: { minRelevanceScore: 50 },
    ...overrides,
  });

  describe('checkBlocked', () => {
    it('should not block when no blocked countries/languages match', () => {
      const result = checkBlocked(createMediaItem(), createPolicy());

      expect(result.isBlocked).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });

    it('should block when origin country is in blocked list (ANY mode)', () => {
      const result = checkBlocked(
        createMediaItem({ originCountries: ['RU'] }),
        createPolicy({ blockedCountryMode: BlockedCountryMode.ANY }),
      );

      expect(result.isBlocked).toBe(true);
      expect(result.reasons).toContain(EvaluationReason.BLOCKED_COUNTRY);
    });

    it('should block when language is in blocked list', () => {
      const result = checkBlocked(createMediaItem({ originalLanguage: 'ru' }), createPolicy());

      expect(result.isBlocked).toBe(true);
      expect(result.reasons).toContain(EvaluationReason.BLOCKED_LANGUAGE);
    });

    it('should include both reasons when country and language are blocked', () => {
      const result = checkBlocked(
        createMediaItem({ originCountries: ['RU'], originalLanguage: 'ru' }),
        createPolicy(),
      );

      expect(result.isBlocked).toBe(true);
      expect(result.reasons).toContain(EvaluationReason.BLOCKED_COUNTRY);
      expect(result.reasons).toContain(EvaluationReason.BLOCKED_LANGUAGE);
    });

    describe('MAJORITY mode', () => {
      it('should block when majority of countries are blocked (2 of 3)', () => {
        const result = checkBlocked(
          createMediaItem({ originCountries: ['RU', 'BY', 'US'] }),
          createPolicy({ blockedCountryMode: BlockedCountryMode.MAJORITY }),
        );

        expect(result.isBlocked).toBe(true);
      });

      it('should not block when minority of countries are blocked (1 of 3)', () => {
        const result = checkBlocked(
          createMediaItem({ originCountries: ['RU', 'US', 'GB'] }),
          createPolicy({ blockedCountryMode: BlockedCountryMode.MAJORITY }),
        );

        expect(result.isBlocked).toBe(false);
      });

      it('should use ANY fallback for 1-2 countries (tie-breaker)', () => {
        const result = checkBlocked(
          createMediaItem({ originCountries: ['RU', 'US'] }),
          createPolicy({ blockedCountryMode: BlockedCountryMode.MAJORITY }),
        );

        expect(result.isBlocked).toBe(true);
      });
    });
  });

  describe('checkNeutral', () => {
    it('should not be neutral when country and language are allowed', () => {
      const result = checkNeutral(createMediaItem(), createPolicy());

      expect(result.isNeutral).toBe(false);
      expect(result.reasons).toHaveLength(0);
    });

    it('should be neutral when country is not in allowed or blocked lists', () => {
      const result = checkNeutral(createMediaItem({ originCountries: ['FR'] }), createPolicy());

      expect(result.isNeutral).toBe(true);
      expect(result.reasons).toContain(EvaluationReason.NEUTRAL_COUNTRY);
    });

    it('should be neutral when language is not in allowed or blocked lists', () => {
      const result = checkNeutral(createMediaItem({ originalLanguage: 'fr' }), createPolicy());

      expect(result.isNeutral).toBe(true);
      expect(result.reasons).toContain(EvaluationReason.NEUTRAL_LANGUAGE);
    });
  });

  describe('tryRelaxedModeEligibility', () => {
    it('should return null in STRICT mode', () => {
      const result = tryRelaxedModeEligibility(
        createMediaItem(),
        createPolicy({ eligibilityMode: EligibilityMode.STRICT }),
      );

      expect(result).toBeNull();
    });

    it('should return eligible in RELAXED mode when country is allowed', () => {
      const result = tryRelaxedModeEligibility(
        createMediaItem({ originCountries: ['US'], originalLanguage: 'fr' }),
        createPolicy({ eligibilityMode: EligibilityMode.RELAXED }),
      );

      expect(result?.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result?.reasons).toContain(EvaluationReason.ALLOWED_COUNTRY);
    });

    it('should return eligible in RELAXED mode when language is allowed', () => {
      const result = tryRelaxedModeEligibility(
        createMediaItem({ originCountries: ['FR'], originalLanguage: 'en' }),
        createPolicy({ eligibilityMode: EligibilityMode.RELAXED }),
      );

      expect(result?.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result?.reasons).toContain(EvaluationReason.ALLOWED_LANGUAGE);
    });

    it('should return null in RELAXED mode when neither is allowed', () => {
      const result = tryRelaxedModeEligibility(
        createMediaItem({ originCountries: ['FR'], originalLanguage: 'fr' }),
        createPolicy({ eligibilityMode: EligibilityMode.RELAXED }),
      );

      expect(result).toBeNull();
    });
  });

  describe('BlockedCountryMode.MAJORITY — property-based invariants', () => {
    const BLOCKED = ['RU', 'BY', 'IR', 'KP', 'SY'];
    const ALLOWED = ['US', 'GB', 'UA', 'DE', 'FR', 'PL', 'CA', 'AU'];

    const policy = createPolicy({
      blockedCountryMode: BlockedCountryMode.MAJORITY,
      blockedCountries: BLOCKED,
      allowedCountries: ALLOWED,
    });

    it('ANY mode always blocks when at least one country is blocked', () => {
      fc.assert(
        fc.property(
          fc.subarray(BLOCKED, { minLength: 1 }),
          fc.subarray(ALLOWED),
          (blocked, allowed) => {
            const countries = [...new Set([...blocked, ...allowed])];
            const result = checkBlocked(
              createMediaItem({ originCountries: countries }),
              createPolicy({
                blockedCountryMode: BlockedCountryMode.ANY,
                blockedCountries: BLOCKED,
              }),
            );
            return result.isBlocked === true;
          },
        ),
      );
    });

    it('MAJORITY mode with ≤ 2 countries behaves like ANY (tie-breaker)', () => {
      fc.assert(
        fc.property(
          fc.subarray(BLOCKED, { minLength: 1, maxLength: 2 }),
          fc.subarray(ALLOWED, { maxLength: 1 }),
          (blocked, allowed) => {
            const countries = [...new Set([...blocked, ...allowed])].slice(0, 2);
            if (countries.length === 0 || !countries.some((c) => BLOCKED.includes(c))) return true;
            const result = checkBlocked(createMediaItem({ originCountries: countries }), policy);
            // For ≤ 2 countries with at least 1 blocked, MAJORITY = ANY = blocked
            return result.isBlocked === true;
          },
        ),
      );
    });

    it('MAJORITY mode with 3+ countries: blocked only when strict majority is blocked', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: BLOCKED.length }),
          fc.integer({ min: 0, max: ALLOWED.length }),
          (blockedCount, allowedCount) => {
            const blocked = BLOCKED.slice(0, blockedCount);
            const allowed = ALLOWED.slice(0, allowedCount);
            const countries = [...new Set([...blocked, ...allowed])];
            if (countries.length <= 2) return true;

            const result = checkBlocked(createMediaItem({ originCountries: countries }), policy);
            const majority = Math.ceil(countries.length / 2);
            const actualBlocked = countries.filter((c) => BLOCKED.includes(c)).length;
            const expectedBlocked = actualBlocked >= majority;
            return result.isBlocked === expectedBlocked;
          },
        ),
      );
    });
  });
});
