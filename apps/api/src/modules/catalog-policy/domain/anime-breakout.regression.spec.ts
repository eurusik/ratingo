/**
 * Regression tests for anime content classification and breakout rules.
 *
 * Tests real-world scenarios with known anime titles to ensure:
 * - Low-signal anime is excluded
 * - Global hit anime passes breakout
 * - Western animation is not affected
 */

import { evaluateEligibility } from './policy-engine';
import { PolicyConfig, PolicyEngineInput } from './types/policy.types';
import { EligibilityStatus, EvaluationReason } from './constants/evaluation.constants';
import { ANIME_GLOBAL_HIT, ANIME_TRAKT_HIT } from './constants/breakout-rules';

/** Policy with anime exclusion and breakout rules. */
const animeExclusionPolicy: PolicyConfig = {
  allowedCountries: ['US', 'UA', 'GB'],
  blockedCountries: [],
  blockedCountryMode: 'ANY',
  allowedLanguages: ['en', 'uk', 'ja'],
  blockedLanguages: [],
  globalProviders: [],
  breakoutRules: [ANIME_GLOBAL_HIT, ANIME_TRAKT_HIT],
  eligibilityMode: 'STRICT',
  homepage: { minRelevanceScore: 50 },
  excludedContentClasses: ['anime'],
};

/** Creates PolicyEngineInput for anime. */
function createAnimeInput(overrides: {
  voteCountImdb?: number;
  voteCountTrakt?: number;
  hasNetflix?: boolean;
}): PolicyEngineInput {
  const { voteCountImdb = 1000, voteCountTrakt = 500, hasNetflix = false } = overrides;

  return {
    mediaItem: {
      id: 'test-anime-id',
      originCountries: ['JP'],
      originalLanguage: 'ja',
      contentClass: 'anime',
      voteCountImdb,
      voteCountTrakt,
      ratingImdb: 8.0,
      ratingMetacritic: null,
      ratingRottenTomatoes: null,
      ratingTrakt: 8.0,
      normalizedOffers: hasNetflix
        ? [{ providerId: 'netflix', offerType: 'flatrate', distributionChannel: 'direct' }]
        : [],
    },
    stats: { qualityScore: 0.7, popularityScore: 0.5, freshnessScore: 0.6, ratingoScore: 0.6 },
  };
}

/** Creates PolicyEngineInput for western animation. */
function createWesternAnimationInput(): PolicyEngineInput {
  return {
    mediaItem: {
      id: 'test-western-animation-id',
      originCountries: ['US'],
      originalLanguage: 'en',
      contentClass: 'mainstream', // Western animation = mainstream, NOT anime
      voteCountImdb: 200000,
      voteCountTrakt: 50000,
      ratingImdb: 8.5,
      ratingMetacritic: 85,
      ratingRottenTomatoes: 95,
      ratingTrakt: 8.5,
      normalizedOffers: [],
    },
    stats: { qualityScore: 0.9, popularityScore: 0.8, freshnessScore: 0.7, ratingoScore: 0.85 },
  };
}

describe('Anime Breakout Regression Tests', () => {
  describe('Low-signal anime (should be INELIGIBLE)', () => {
    it('Gachiakuta-like anime: low IMDB votes, no streaming', () => {
      const input = createAnimeInput({ voteCountImdb: 1000, voteCountTrakt: 500 });
      const result = evaluateEligibility(input, animeExclusionPolicy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain(EvaluationReason.EXCLUDED_CONTENT_CLASS);
      expect(result.breakoutRuleId).toBeNull();
    });

    it('Seasonal anime: moderate votes but below threshold', () => {
      const input = createAnimeInput({ voteCountImdb: 20000, voteCountTrakt: 5000 });
      const result = evaluateEligibility(input, animeExclusionPolicy);

      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain(EvaluationReason.EXCLUDED_CONTENT_CLASS);
    });

    it('Anime on Netflix but low votes', () => {
      const input = createAnimeInput({ voteCountImdb: 10000, hasNetflix: true });
      const result = evaluateEligibility(input, animeExclusionPolicy);

      // Has Netflix but not enough votes for ANIME_GLOBAL_HIT (50k required)
      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain(EvaluationReason.EXCLUDED_CONTENT_CLASS);
    });
  });

  describe('Global hit anime (should be ELIGIBLE via breakout)', () => {
    it('Attack on Titan-like: high IMDB votes + Netflix', () => {
      const input = createAnimeInput({ voteCountImdb: 500000, hasNetflix: true });
      const result = evaluateEligibility(input, animeExclusionPolicy);

      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.reasons).toContain(EvaluationReason.EXCLUDED_CONTENT_CLASS);
      expect(result.reasons).toContain(EvaluationReason.BREAKOUT_ALLOWED);
      expect(result.breakoutRuleId).toBe('ANIME_GLOBAL_HIT');
    });

    it('One Piece-like: high Trakt + moderate IMDB (ANIME_TRAKT_HIT)', () => {
      const input = createAnimeInput({ voteCountImdb: 30000, voteCountTrakt: 15000 });
      const result = evaluateEligibility(input, animeExclusionPolicy);

      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.reasons).toContain(EvaluationReason.EXCLUDED_CONTENT_CLASS);
      expect(result.reasons).toContain(EvaluationReason.BREAKOUT_ALLOWED);
      expect(result.breakoutRuleId).toBe('ANIME_TRAKT_HIT');
    });

    it('Demon Slayer-like: meets both rules, picks higher priority', () => {
      const input = createAnimeInput({
        voteCountImdb: 100000,
        voteCountTrakt: 20000,
        hasNetflix: true,
      });
      const result = evaluateEligibility(input, animeExclusionPolicy);

      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      // ANIME_GLOBAL_HIT has priority 10, ANIME_TRAKT_HIT has priority 11
      // Lower number = higher priority, so ANIME_GLOBAL_HIT wins
      expect(result.breakoutRuleId).toBe('ANIME_GLOBAL_HIT');
    });
  });

  describe('Western animation (should NOT be affected)', () => {
    it('Spider-Verse: US origin, classified as mainstream', () => {
      const input = createWesternAnimationInput();
      const result = evaluateEligibility(input, animeExclusionPolicy);

      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.reasons).not.toContain(EvaluationReason.EXCLUDED_CONTENT_CLASS);
      expect(result.breakoutRuleId).toBeNull();
    });

    it('Puss in Boots: US animation, not excluded', () => {
      const input: PolicyEngineInput = {
        mediaItem: {
          id: 'puss-in-boots',
          originCountries: ['US'],
          originalLanguage: 'en',
          contentClass: 'mainstream',
          voteCountImdb: 150000,
          voteCountTrakt: 30000,
          ratingImdb: 7.5,
          ratingMetacritic: 70,
          ratingRottenTomatoes: 85,
          ratingTrakt: 7.5,
          normalizedOffers: [],
        },
        stats: { qualityScore: 0.75, popularityScore: 0.7, freshnessScore: 0.6, ratingoScore: 0.7 },
      };

      const result = evaluateEligibility(input, animeExclusionPolicy);

      expect(result.status).toBe(EligibilityStatus.ELIGIBLE);
      expect(result.reasons).not.toContain(EvaluationReason.EXCLUDED_CONTENT_CLASS);
    });
  });

  describe('Edge cases', () => {
    it('Korean animation: KR origin, should be mainstream (not anime)', () => {
      const input: PolicyEngineInput = {
        mediaItem: {
          id: 'korean-animation',
          originCountries: ['KR'],
          originalLanguage: 'ko',
          contentClass: 'mainstream', // Korean animation = mainstream
          voteCountImdb: 5000,
          voteCountTrakt: 2000,
          ratingImdb: 7.0,
          ratingMetacritic: null,
          ratingRottenTomatoes: null,
          ratingTrakt: 7.0,
          normalizedOffers: [],
        },
        stats: { qualityScore: 0.6, popularityScore: 0.4, freshnessScore: 0.5, ratingoScore: 0.5 },
      };

      const result = evaluateEligibility(input, animeExclusionPolicy);

      // Korean animation is mainstream, not excluded
      expect(result.reasons).not.toContain(EvaluationReason.EXCLUDED_CONTENT_CLASS);
    });

    it('Anime with empty normalizedOffers: cannot match provider-based breakout', () => {
      const input = createAnimeInput({ voteCountImdb: 60000, hasNetflix: false });
      const result = evaluateEligibility(input, animeExclusionPolicy);

      // Has enough IMDB votes for ANIME_GLOBAL_HIT but no providers
      // ANIME_TRAKT_HIT requires 10k Trakt votes, this has only 500
      expect(result.status).toBe(EligibilityStatus.INELIGIBLE);
      expect(result.reasons).toContain(EvaluationReason.EXCLUDED_CONTENT_CLASS);
    });
  });
});
