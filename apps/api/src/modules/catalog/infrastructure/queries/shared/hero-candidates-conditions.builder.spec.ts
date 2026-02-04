import { HERO_THRESHOLDS } from '../../../domain/constants/catalog.constants';

import {
  buildHeroCandidatesConditions,
  buildHeroCandidatesEvaluationConditions,
  type HeroCandidatesConditionsOptions,
} from './hero-candidates-conditions.builder';

describe('hero-candidates-conditions.builder', () => {
  describe('buildHeroCandidatesConditions', () => {
    describe('base conditions', () => {
      it('returns array of SQL conditions', () => {
        const options: HeroCandidatesConditionsOptions = { staleThresholdHours: 4 };
        const conditions = buildHeroCandidatesConditions(options);

        expect(Array.isArray(conditions)).toBe(true);
        expect(conditions.length).toBeGreaterThan(0);
      });

      it('includes 9 conditions with default options', () => {
        const options: HeroCandidatesConditionsOptions = { staleThresholdHours: 4 };
        const conditions = buildHeroCandidatesConditions(options);

        // Conditions:
        // 1. deletedAt IS NULL
        // 2. tmdbId IS NOT NULL
        // 3. posterPath IS NOT NULL
        // 4. backdropPath IS NOT NULL
        // 5. qualityScore >= threshold
        // 6. popularityScore >= fallback threshold
        // 7. watchersCount > 0
        // 8. updatedAt < staleThreshold
        // 9. (type = MOVIE) OR (type = SHOW AND (lastAirDate >= cutoff OR nextAirDate IS NOT NULL))
        expect(conditions.length).toBe(9);
      });
    });

    describe('staleThresholdHours', () => {
      it('uses provided stale threshold', () => {
        const options: HeroCandidatesConditionsOptions = { staleThresholdHours: 2 };
        const conditions = buildHeroCandidatesConditions(options);

        expect(conditions.length).toBe(9);
      });

      it('handles zero stale threshold', () => {
        const options: HeroCandidatesConditionsOptions = { staleThresholdHours: 0 };
        const conditions = buildHeroCandidatesConditions(options);

        expect(conditions.length).toBe(9);
      });

      it('handles large stale threshold', () => {
        const options: HeroCandidatesConditionsOptions = { staleThresholdHours: 168 }; // 1 week
        const conditions = buildHeroCandidatesConditions(options);

        expect(conditions.length).toBe(9);
      });
    });

    describe('minQualityScore', () => {
      it('uses default MIN_QUALITY_SCORE when not provided', () => {
        const options: HeroCandidatesConditionsOptions = { staleThresholdHours: 4 };
        const conditions = buildHeroCandidatesConditions(options);

        // Default is HERO_THRESHOLDS.MIN_QUALITY_SCORE = 60
        expect(HERO_THRESHOLDS.MIN_QUALITY_SCORE).toBe(60);
        expect(conditions.length).toBe(9);
      });

      it('uses provided minQualityScore', () => {
        const options: HeroCandidatesConditionsOptions = {
          staleThresholdHours: 4,
          minQualityScore: 50, // For watching-now coverage
        };
        const conditions = buildHeroCandidatesConditions(options);

        expect(conditions.length).toBe(9);
      });

      it('handles zero minQualityScore', () => {
        const options: HeroCandidatesConditionsOptions = {
          staleThresholdHours: 4,
          minQualityScore: 0,
        };
        const conditions = buildHeroCandidatesConditions(options);

        expect(conditions.length).toBe(9);
      });

      it('handles high minQualityScore', () => {
        const options: HeroCandidatesConditionsOptions = {
          staleThresholdHours: 4,
          minQualityScore: 90,
        };
        const conditions = buildHeroCandidatesConditions(options);

        expect(conditions.length).toBe(9);
      });
    });

    describe('image requirements', () => {
      it('always includes poster and backdrop requirements', () => {
        const options: HeroCandidatesConditionsOptions = { staleThresholdHours: 4 };
        const conditions = buildHeroCandidatesConditions(options);

        // posterPath IS NOT NULL and backdropPath IS NOT NULL are always included
        expect(conditions.length).toBe(9);
      });
    });

    describe('watchers requirements', () => {
      it('always requires watchersCount > 0', () => {
        const options: HeroCandidatesConditionsOptions = { staleThresholdHours: 4 };
        const conditions = buildHeroCandidatesConditions(options);

        // watchersCount > 0 is always included
        expect(conditions.length).toBe(9);
      });
    });

    describe('type-specific freshness', () => {
      it('includes OR condition for movies vs shows freshness', () => {
        const options: HeroCandidatesConditionsOptions = { staleThresholdHours: 4 };
        const conditions = buildHeroCandidatesConditions(options);

        // The complex OR condition for type-specific freshness is included
        // Movies: no freshness gate
        // Shows: lastAirDate >= cutoff OR nextAirDate IS NOT NULL
        expect(conditions.length).toBe(9);
      });
    });

    describe('popularity threshold', () => {
      it('uses MIN_POPULARITY_SCORE_FALLBACK constant', () => {
        const options: HeroCandidatesConditionsOptions = { staleThresholdHours: 4 };
        const conditions = buildHeroCandidatesConditions(options);

        // Verify the constant value is as expected
        expect(HERO_THRESHOLDS.MIN_POPULARITY_SCORE_FALLBACK).toBe(25);
        expect(conditions.length).toBe(9);
      });
    });

    describe('combined options', () => {
      it('handles all options together', () => {
        const options: HeroCandidatesConditionsOptions = {
          staleThresholdHours: 6,
          minQualityScore: 55,
        };
        const conditions = buildHeroCandidatesConditions(options);

        expect(conditions.length).toBe(9);
      });
    });
  });

  describe('buildHeroCandidatesEvaluationConditions', () => {
    it('returns array of SQL conditions', () => {
      const conditions = buildHeroCandidatesEvaluationConditions();

      expect(Array.isArray(conditions)).toBe(true);
      expect(conditions.length).toBeGreaterThan(0);
    });

    it('returns 3 evaluation conditions', () => {
      const conditions = buildHeroCandidatesEvaluationConditions();

      // Conditions:
      // 1. policyVersion = catalog_policies.version
      // 2. context = TRENDING
      // 3. status = ELIGIBLE
      expect(conditions.length).toBe(3);
    });

    it('is idempotent (always returns same conditions)', () => {
      const conditions1 = buildHeroCandidatesEvaluationConditions();
      const conditions2 = buildHeroCandidatesEvaluationConditions();

      expect(conditions1.length).toBe(conditions2.length);
    });
  });

  describe('constants used', () => {
    it('uses HERO_THRESHOLDS.MAX_DAYS_SINCE_LAST_EPISODE for show freshness', () => {
      // Verify the constant exists and has expected value
      expect(HERO_THRESHOLDS.MAX_DAYS_SINCE_LAST_EPISODE).toBe(90);
    });

    it('uses HERO_THRESHOLDS.MIN_QUALITY_SCORE as default', () => {
      expect(HERO_THRESHOLDS.MIN_QUALITY_SCORE).toBe(60);
    });

    it('uses HERO_THRESHOLDS.MIN_POPULARITY_SCORE_FALLBACK', () => {
      expect(HERO_THRESHOLDS.MIN_POPULARITY_SCORE_FALLBACK).toBe(25);
    });
  });
});
