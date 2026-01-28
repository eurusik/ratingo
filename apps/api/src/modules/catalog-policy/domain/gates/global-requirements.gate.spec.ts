import { EvaluationContext } from '../constants/evaluation.constants';
import { RatingSource, VoteSource, GlobalGateCheck } from '../types/policy.types';
import {
  shouldApplyGlobalGate,
  hasAnyRating,
  checkGlobalRequirements,
  checkLocalMaturityOverride,
} from './global-requirements.gate';
import type {
  GlobalRequirements,
  LocalMaturityOverride,
  PolicyEngineInput,
} from '../types/policy.types';

describe('GlobalRequirementsGate', () => {
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

  describe('shouldApplyGlobalGate', () => {
    it('should return false when requirements is undefined', () => {
      expect(shouldApplyGlobalGate(undefined)).toBe(false);
    });

    it('should return true for catalog context by default', () => {
      const requirements: GlobalRequirements = { minQualityScoreNormalized: 0.5 };
      expect(shouldApplyGlobalGate(requirements, EvaluationContext.CATALOG)).toBe(true);
    });

    it('should return true for homepage context by default', () => {
      const requirements: GlobalRequirements = { minQualityScoreNormalized: 0.5 };
      expect(shouldApplyGlobalGate(requirements, EvaluationContext.HOMEPAGE)).toBe(true);
    });

    it('should return false for now_playing context by default', () => {
      const requirements: GlobalRequirements = { minQualityScoreNormalized: 0.5 };
      expect(shouldApplyGlobalGate(requirements, EvaluationContext.NOW_PLAYING)).toBe(false);
    });

    it('should respect custom appliesTo', () => {
      const requirements: GlobalRequirements = {
        minQualityScoreNormalized: 0.5,
        appliesTo: [EvaluationContext.NOW_PLAYING],
      };
      expect(shouldApplyGlobalGate(requirements, EvaluationContext.NOW_PLAYING)).toBe(true);
      expect(shouldApplyGlobalGate(requirements, EvaluationContext.CATALOG)).toBe(false);
    });
  });

  describe('hasAnyRating', () => {
    it('should return false when no ratings are present', () => {
      const mediaItem = createMediaItem();
      expect(hasAnyRating(mediaItem, [RatingSource.IMDB, RatingSource.TRAKT])).toBe(false);
    });

    it('should return true when IMDb rating is present', () => {
      const mediaItem = createMediaItem({ ratingImdb: 7.5 });
      expect(hasAnyRating(mediaItem, [RatingSource.IMDB])).toBe(true);
    });

    it('should return true when Metacritic rating is present', () => {
      const mediaItem = createMediaItem({ ratingMetacritic: 75 });
      expect(hasAnyRating(mediaItem, [RatingSource.METACRITIC])).toBe(true);
    });

    it('should return true when RT rating is present', () => {
      const mediaItem = createMediaItem({ ratingRottenTomatoes: 80 });
      expect(hasAnyRating(mediaItem, [RatingSource.RT])).toBe(true);
    });

    it('should return true when Trakt rating is present', () => {
      const mediaItem = createMediaItem({ ratingTrakt: 7.8 });
      expect(hasAnyRating(mediaItem, [RatingSource.TRAKT])).toBe(true);
    });

    it('should return false when rating is NaN', () => {
      const mediaItem = createMediaItem({ ratingImdb: NaN });
      expect(hasAnyRating(mediaItem, [RatingSource.IMDB])).toBe(false);
    });

    it('should return true when any of multiple ratings is present', () => {
      const mediaItem = createMediaItem({ ratingTrakt: 7.5 });
      expect(hasAnyRating(mediaItem, [RatingSource.IMDB, RatingSource.TRAKT])).toBe(true);
    });
  });

  describe('checkGlobalRequirements', () => {
    it('should pass when no requirements are configured', () => {
      const result = checkGlobalRequirements(createInput(), undefined);

      expect(result.passes).toBe(true);
      expect(result.failedChecks).toHaveLength(0);
    });

    it('should pass when all requirements are met', () => {
      const input = createInput(
        { ratingImdb: 7.5 },
        { qualityScore: 0.7, popularityScore: 0.5, freshnessScore: 0.3, ratingoScore: 70 },
      );
      const requirements: GlobalRequirements = {
        minQualityScoreNormalized: 0.5,
        requireAnyOfRatingsPresent: [RatingSource.IMDB],
      };

      const result = checkGlobalRequirements(input, requirements);

      expect(result.passes).toBe(true);
      expect(result.failedChecks).toHaveLength(0);
    });

    describe('minQualityScoreNormalized', () => {
      it('should fail when quality score is below minimum', () => {
        const input = createInput(
          {},
          { qualityScore: 0.3, popularityScore: 0.5, freshnessScore: 0.3, ratingoScore: 30 },
        );
        const requirements: GlobalRequirements = { minQualityScoreNormalized: 0.5 };

        const result = checkGlobalRequirements(input, requirements);

        expect(result.passes).toBe(false);
        expect(result.failedChecks).toContain(GlobalGateCheck.MIN_QUALITY_SCORE);
      });

      it('should fail when quality score is null', () => {
        const input = createInput(
          {},
          { qualityScore: null, popularityScore: 0.5, freshnessScore: 0.3, ratingoScore: null },
        );
        const requirements: GlobalRequirements = { minQualityScoreNormalized: 0.5 };

        const result = checkGlobalRequirements(input, requirements);

        expect(result.passes).toBe(false);
        expect(result.failedChecks).toContain(GlobalGateCheck.MIN_QUALITY_SCORE);
      });

      it('should fail when stats is null', () => {
        const input = createInput({}, null);
        const requirements: GlobalRequirements = { minQualityScoreNormalized: 0.5 };

        const result = checkGlobalRequirements(input, requirements);

        expect(result.passes).toBe(false);
        expect(result.failedChecks).toContain(GlobalGateCheck.MIN_QUALITY_SCORE);
      });
    });

    describe('requireAnyOfRatingsPresent', () => {
      it('should fail when no required ratings are present', () => {
        const input = createInput();
        const requirements: GlobalRequirements = {
          requireAnyOfRatingsPresent: [RatingSource.IMDB, RatingSource.TRAKT],
        };

        const result = checkGlobalRequirements(input, requirements);

        expect(result.passes).toBe(false);
        expect(result.failedChecks).toContain(GlobalGateCheck.REQUIRE_RATINGS);
      });

      it('should pass when at least one required rating is present', () => {
        const input = createInput({ ratingImdb: 7.5 });
        const requirements: GlobalRequirements = {
          requireAnyOfRatingsPresent: [RatingSource.IMDB, RatingSource.TRAKT],
        };

        const result = checkGlobalRequirements(input, requirements);

        expect(result.passes).toBe(true);
      });
    });

    describe('minVotesAnyOf', () => {
      it('should fail when no source meets the threshold', () => {
        const input = createInput({ voteCountImdb: 1000, voteCountTrakt: 500 });
        const requirements: GlobalRequirements = {
          minVotesAnyOf: { sources: [VoteSource.IMDB, VoteSource.TRAKT], min: 5000 },
        };

        const result = checkGlobalRequirements(input, requirements);

        expect(result.passes).toBe(false);
        expect(result.failedChecks).toContain(GlobalGateCheck.MIN_VOTES);
      });

      it('should pass when any source meets the threshold', () => {
        const input = createInput({ voteCountImdb: 10000, voteCountTrakt: 500 });
        const requirements: GlobalRequirements = {
          minVotesAnyOf: { sources: [VoteSource.IMDB, VoteSource.TRAKT], min: 5000 },
        };

        const result = checkGlobalRequirements(input, requirements);

        expect(result.passes).toBe(true);
      });
    });

    it('should report multiple failed checks', () => {
      const input = createInput();
      const requirements: GlobalRequirements = {
        minQualityScoreNormalized: 0.5,
        requireAnyOfRatingsPresent: [RatingSource.IMDB],
        minVotesAnyOf: { sources: [VoteSource.IMDB], min: 1000 },
      };

      const result = checkGlobalRequirements(input, requirements);

      expect(result.passes).toBe(false);
      expect(result.failedChecks).toHaveLength(3);
    });

    describe('localMaturityOverride', () => {
      const overrideConfig: LocalMaturityOverride = {
        minFreshnessScoreNormalized: 0.9,
        minLocalWatchers: 30,
      };

      it('should apply override when votes fail but freshness and watchers pass', () => {
        const input = createInput(
          { voteCountImdb: 500, voteCountTrakt: 500 },
          {
            qualityScore: 0.7,
            popularityScore: 0.5,
            freshnessScore: 0.95,
            ratingoScore: 70,
            watchersCount: 50,
          },
        );
        const requirements: GlobalRequirements = {
          minVotesAnyOf: { sources: [VoteSource.IMDB, VoteSource.TRAKT], min: 1000 },
          localMaturityOverride: overrideConfig,
        };

        const result = checkGlobalRequirements(input, requirements);

        expect(result.passes).toBe(true);
        expect(result.localMaturityOverrideApplied).toBe(true);
        expect(result.failedChecks).toHaveLength(0);
      });

      it('should NOT apply override when freshness is below threshold', () => {
        const input = createInput(
          { voteCountImdb: 500 },
          {
            qualityScore: 0.7,
            popularityScore: 0.5,
            freshnessScore: 0.5, // Below 0.9 threshold
            ratingoScore: 70,
            watchersCount: 50,
          },
        );
        const requirements: GlobalRequirements = {
          minVotesAnyOf: { sources: [VoteSource.IMDB], min: 1000 },
          localMaturityOverride: overrideConfig,
        };

        const result = checkGlobalRequirements(input, requirements);

        expect(result.passes).toBe(false);
        expect(result.localMaturityOverrideApplied).toBeFalsy();
        expect(result.failedChecks).toContain(GlobalGateCheck.MIN_VOTES);
      });

      it('should NOT apply override when watchers are below threshold', () => {
        const input = createInput(
          { voteCountImdb: 500 },
          {
            qualityScore: 0.7,
            popularityScore: 0.5,
            freshnessScore: 0.95,
            ratingoScore: 70,
            watchersCount: 10, // Below 30 threshold
          },
        );
        const requirements: GlobalRequirements = {
          minVotesAnyOf: { sources: [VoteSource.IMDB], min: 1000 },
          localMaturityOverride: overrideConfig,
        };

        const result = checkGlobalRequirements(input, requirements);

        expect(result.passes).toBe(false);
        expect(result.localMaturityOverrideApplied).toBeFalsy();
        expect(result.failedChecks).toContain(GlobalGateCheck.MIN_VOTES);
      });

      it('should NOT apply override when watchersCount is null', () => {
        const input = createInput(
          { voteCountImdb: 500 },
          {
            qualityScore: 0.7,
            popularityScore: 0.5,
            freshnessScore: 0.95,
            ratingoScore: 70,
            watchersCount: null,
          },
        );
        const requirements: GlobalRequirements = {
          minVotesAnyOf: { sources: [VoteSource.IMDB], min: 1000 },
          localMaturityOverride: overrideConfig,
        };

        const result = checkGlobalRequirements(input, requirements);

        expect(result.passes).toBe(false);
        expect(result.failedChecks).toContain(GlobalGateCheck.MIN_VOTES);
      });

      it('should NOT check override when votes pass', () => {
        const input = createInput(
          { voteCountImdb: 5000 }, // Above threshold
          {
            qualityScore: 0.7,
            popularityScore: 0.5,
            freshnessScore: 0.1, // Low freshness - wouldn't pass override
            ratingoScore: 70,
            watchersCount: 5, // Low watchers - wouldn't pass override
          },
        );
        const requirements: GlobalRequirements = {
          minVotesAnyOf: { sources: [VoteSource.IMDB], min: 1000 },
          localMaturityOverride: overrideConfig,
        };

        const result = checkGlobalRequirements(input, requirements);

        expect(result.passes).toBe(true);
        expect(result.localMaturityOverrideApplied).toBeFalsy();
      });
    });
  });

  describe('checkLocalMaturityOverride', () => {
    const override: LocalMaturityOverride = {
      minFreshnessScoreNormalized: 0.9,
      minLocalWatchers: 30,
    };

    it('should return true when both freshness and watchers meet thresholds', () => {
      const input = createInput(
        {},
        {
          qualityScore: 0.5,
          popularityScore: 0.5,
          freshnessScore: 0.95,
          ratingoScore: 50,
          watchersCount: 50,
        },
      );

      expect(checkLocalMaturityOverride(input, override)).toBe(true);
    });

    it('should return false when freshness is below threshold', () => {
      const input = createInput(
        {},
        {
          qualityScore: 0.5,
          popularityScore: 0.5,
          freshnessScore: 0.8,
          ratingoScore: 50,
          watchersCount: 50,
        },
      );

      expect(checkLocalMaturityOverride(input, override)).toBe(false);
    });

    it('should return false when watchers are below threshold', () => {
      const input = createInput(
        {},
        {
          qualityScore: 0.5,
          popularityScore: 0.5,
          freshnessScore: 0.95,
          ratingoScore: 50,
          watchersCount: 20,
        },
      );

      expect(checkLocalMaturityOverride(input, override)).toBe(false);
    });

    it('should return false when stats is null', () => {
      const input = createInput({}, null);

      expect(checkLocalMaturityOverride(input, override)).toBe(false);
    });

    it('should return false when freshnessScore is null', () => {
      const input = createInput(
        {},
        {
          qualityScore: 0.5,
          popularityScore: 0.5,
          freshnessScore: null,
          ratingoScore: 50,
          watchersCount: 50,
        },
      );

      expect(checkLocalMaturityOverride(input, override)).toBe(false);
    });

    it('should return true when values exactly meet thresholds', () => {
      const input = createInput(
        {},
        {
          qualityScore: 0.5,
          popularityScore: 0.5,
          freshnessScore: 0.9, // Exactly at threshold
          ratingoScore: 50,
          watchersCount: 30, // Exactly at threshold
        },
      );

      expect(checkLocalMaturityOverride(input, override)).toBe(true);
    });
  });
});
