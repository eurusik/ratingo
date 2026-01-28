import {
  EligibilityStatus,
  EvaluationReason,
  EvaluationContext,
} from '../constants/evaluation.constants';
import { BlockedCountryMode, EligibilityMode } from '../types/policy.types';
import {
  getDefaultContextRequirements,
  getContextRequirements,
  checkDisplayGates,
} from './display.gate';
import type { PolicyConfig, PolicyEngineInput } from '../types/policy.types';

describe('DisplayGate', () => {
  const createMediaItem = (
    overrides: Partial<PolicyEngineInput['mediaItem']> = {},
  ): PolicyEngineInput['mediaItem'] => ({
    id: 'test-id',
    originCountries: ['US'],
    originalLanguage: 'en',
    title: 'Test Movie',
    overview:
      'This is a sufficiently long overview for testing purposes that exceeds the minimum character requirement.',
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
    allowedCountries: ['US'],
    blockedCountries: [],
    blockedCountryMode: BlockedCountryMode.ANY,
    allowedLanguages: ['en'],
    blockedLanguages: [],
    globalProviders: [],
    breakoutRules: [],
    eligibilityMode: EligibilityMode.STRICT,
    homepage: { minRelevanceScore: 50 },
    ...overrides,
  });

  describe('getDefaultContextRequirements', () => {
    it('should require readable title for all contexts', () => {
      expect(getDefaultContextRequirements(EvaluationContext.CATALOG).requireReadableTitle).toBe(
        true,
      );
      expect(getDefaultContextRequirements(EvaluationContext.HOMEPAGE).requireReadableTitle).toBe(
        true,
      );
      expect(getDefaultContextRequirements(EvaluationContext.TRENDING).requireReadableTitle).toBe(
        true,
      );
      expect(getDefaultContextRequirements(EvaluationContext.SEARCH).requireReadableTitle).toBe(
        true,
      );
      expect(getDefaultContextRequirements(EvaluationContext.SEARCH).requireReadableTitle).toBe(
        true,
      );
    });

    it('should require overview for trending and homepage', () => {
      expect(getDefaultContextRequirements(EvaluationContext.TRENDING).requireOverview).toBe(true);
      expect(getDefaultContextRequirements(EvaluationContext.HOMEPAGE).requireOverview).toBe(true);
    });

    it('should not require overview for catalog, search, details', () => {
      expect(getDefaultContextRequirements(EvaluationContext.CATALOG).requireOverview).toBe(false);
      expect(getDefaultContextRequirements(EvaluationContext.SEARCH).requireOverview).toBe(false);
      expect(getDefaultContextRequirements(EvaluationContext.NOW_PLAYING).requireOverview).toBe(
        false,
      );
    });

    it('should set minOverviewChars to 60 when overview required', () => {
      expect(getDefaultContextRequirements(EvaluationContext.TRENDING).minOverviewChars).toBe(60);
      expect(getDefaultContextRequirements(EvaluationContext.HOMEPAGE).minOverviewChars).toBe(60);
    });

    it('should set minOverviewChars to 0 when overview not required', () => {
      expect(getDefaultContextRequirements(EvaluationContext.CATALOG).minOverviewChars).toBe(0);
    });
  });

  describe('getContextRequirements', () => {
    it('should return defaults when no context requirements configured', () => {
      const policy = createPolicy();
      const result = getContextRequirements(policy, EvaluationContext.CATALOG);

      expect(result.requireReadableTitle).toBe(true);
      expect(result.requireOverview).toBe(false);
    });

    it('should merge configured requirements with defaults', () => {
      const policy = createPolicy({
        contextRequirements: {
          [EvaluationContext.CATALOG]: {
            requireOverview: true,
            minOverviewChars: 100,
          },
        },
      });
      const result = getContextRequirements(policy, EvaluationContext.CATALOG);

      expect(result.requireReadableTitle).toBe(true); // from defaults
      expect(result.requireOverview).toBe(true); // from config
      expect(result.minOverviewChars).toBe(100); // from config
    });

    it('should override defaults with configured values', () => {
      const policy = createPolicy({
        contextRequirements: {
          [EvaluationContext.TRENDING]: {
            requireOverview: false,
          },
        },
      });
      const result = getContextRequirements(policy, EvaluationContext.TRENDING);

      expect(result.requireOverview).toBe(false);
    });
  });

  describe('checkDisplayGates', () => {
    it('should pass when all display requirements are met', () => {
      const result = checkDisplayGates(
        createMediaItem(),
        createPolicy(),
        EvaluationContext.CATALOG,
      );

      expect(result.passes).toBe(true);
      expect(result.evaluation).toBeNull();
    });

    describe('title readability', () => {
      it('should fail for CJK-only title', () => {
        const result = checkDisplayGates(
          createMediaItem({ title: 'ファイナルファンタジー' }),
          createPolicy(),
          EvaluationContext.CATALOG,
        );

        expect(result.passes).toBe(false);
        expect(result.evaluation?.status).toBe(EligibilityStatus.INELIGIBLE);
        expect(result.evaluation?.reasons).toContain(EvaluationReason.MISSING_TRANSLATED_TITLE);
      });

      it('should pass for title with Latin characters', () => {
        const result = checkDisplayGates(
          createMediaItem({ title: 'Final Fantasy VII' }),
          createPolicy(),
          EvaluationContext.CATALOG,
        );

        expect(result.passes).toBe(true);
      });

      it('should pass for mixed CJK and Latin title', () => {
        const result = checkDisplayGates(
          createMediaItem({ title: 'ファイナルファンタジー (Final Fantasy)' }),
          createPolicy(),
          EvaluationContext.CATALOG,
        );

        expect(result.passes).toBe(true);
      });
    });

    describe('overview requirements', () => {
      it('should fail when overview is missing for trending', () => {
        const result = checkDisplayGates(
          createMediaItem({ overview: null }),
          createPolicy(),
          EvaluationContext.TRENDING,
        );

        expect(result.passes).toBe(false);
        expect(result.evaluation?.reasons).toContain(EvaluationReason.MISSING_OVERVIEW);
      });

      it('should fail when overview is too short for trending', () => {
        const result = checkDisplayGates(
          createMediaItem({ overview: 'Short text' }),
          createPolicy(),
          EvaluationContext.TRENDING,
        );

        expect(result.passes).toBe(false);
        expect(result.evaluation?.reasons).toContain(EvaluationReason.MISSING_OVERVIEW);
      });

      it('should fail when overview is placeholder (TBA)', () => {
        const result = checkDisplayGates(
          createMediaItem({ overview: 'TBA' }),
          createPolicy(),
          EvaluationContext.TRENDING,
        );

        expect(result.passes).toBe(false);
        expect(result.evaluation?.reasons).toContain(EvaluationReason.MISSING_OVERVIEW);
      });

      it('should fail when overview is placeholder (N/A)', () => {
        const result = checkDisplayGates(
          createMediaItem({ overview: 'N/A' }),
          createPolicy(),
          EvaluationContext.TRENDING,
        );

        expect(result.passes).toBe(false);
      });

      it('should fail when overview is placeholder (Coming soon)', () => {
        const result = checkDisplayGates(
          createMediaItem({ overview: 'Coming soon' }),
          createPolicy(),
          EvaluationContext.TRENDING,
        );

        expect(result.passes).toBe(false);
      });

      it('should not require overview for catalog context', () => {
        const result = checkDisplayGates(
          createMediaItem({ overview: null }),
          createPolicy(),
          EvaluationContext.CATALOG,
        );

        expect(result.passes).toBe(true);
      });
    });
  });
});
