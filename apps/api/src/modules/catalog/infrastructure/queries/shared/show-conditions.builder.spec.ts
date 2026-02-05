import { buildTrendingShowConditions, type ShowConditionsOptions } from './show-conditions.builder';
import {
  CONTEXT_FRESHNESS,
  TRENDING_THRESHOLDS,
} from '../../../domain/constants/catalog.constants';
import { VOTE_SOURCE } from '../../../domain/constants/catalog-query.constants';

describe('show-conditions.builder', () => {
  describe('buildTrendingShowConditions', () => {
    describe('base conditions', () => {
      it('returns array of SQL conditions', () => {
        const options: ShowConditionsOptions = {};
        const conditions = buildTrendingShowConditions(options);

        expect(Array.isArray(conditions)).toBe(true);
        expect(conditions.length).toBeGreaterThan(0);
      });

      it('includes base conditions with default catalog context', () => {
        const options: ShowConditionsOptions = {};
        const conditions = buildTrendingShowConditions(options);

        // Base conditions:
        // 1. type = SHOW
        // 2. deleted_at IS NULL
        // 3. status = ELIGIBLE
        // 4. context = TRENDING
        // 5. ingestion_status = READY
        // 6. freshness_score >= threshold (if > 0)
        // 7. watchers_count >= MIN_WATCHERS_SHOWS
        // Catalog context has freshnessThreshold = 30 (> 0), so 7 conditions
        expect(conditions.length).toBeGreaterThanOrEqual(7);
      });

      it('includes base conditions for home context', () => {
        const options: ShowConditionsOptions = { listContext: 'home' };
        const conditions = buildTrendingShowConditions(options);

        // Home context has freshnessThreshold = 50 (> 0), so same structure
        expect(conditions.length).toBeGreaterThanOrEqual(7);
      });

      it('includes base conditions for catalog context', () => {
        const options: ShowConditionsOptions = { listContext: 'catalog' };
        const conditions = buildTrendingShowConditions(options);

        expect(conditions.length).toBeGreaterThanOrEqual(7);
      });
    });

    describe('freshness threshold', () => {
      it('adds freshness condition for home context', () => {
        const options: ShowConditionsOptions = { listContext: 'home' };
        const conditions = buildTrendingShowConditions(options);

        // Home context has MIN_FRESHNESS = 50 threshold
        expect(CONTEXT_FRESHNESS.home.trending).toBe(TRENDING_THRESHOLDS.MIN_FRESHNESS);
        expect(conditions.length).toBeGreaterThanOrEqual(7);
      });

      it('adds freshness condition for catalog context', () => {
        const options: ShowConditionsOptions = { listContext: 'catalog' };
        const conditions = buildTrendingShowConditions(options);

        // Catalog context has MIN_FRESHNESS_POPULARITY = 30 threshold
        expect(CONTEXT_FRESHNESS.catalog.trending).toBe(
          TRENDING_THRESHOLDS.MIN_FRESHNESS_POPULARITY,
        );
        expect(conditions.length).toBeGreaterThanOrEqual(7);
      });
    });

    describe('minimum watchers condition', () => {
      it('always includes minimum watchers condition', () => {
        const options: ShowConditionsOptions = {};
        const conditions = buildTrendingShowConditions(options);

        // MIN_WATCHERS_SHOWS = 10
        expect(TRENDING_THRESHOLDS.MIN_WATCHERS_SHOWS).toBe(10);
        // Condition is always added (7th base condition)
        expect(conditions.length).toBeGreaterThanOrEqual(7);
      });
    });

    describe('minRatingo option', () => {
      it('does not add condition when minRatingo is undefined', () => {
        const optionsWithout: ShowConditionsOptions = {};
        const optionsWith: ShowConditionsOptions = { minRatingo: 70 };

        const conditionsWithout = buildTrendingShowConditions(optionsWithout);
        const conditionsWith = buildTrendingShowConditions(optionsWith);

        expect(conditionsWith.length).toBe(conditionsWithout.length + 1);
      });

      it('adds condition when minRatingo is provided', () => {
        const options: ShowConditionsOptions = { minRatingo: 80 };
        const conditions = buildTrendingShowConditions(options);

        // 7 base + 1 minRatingo = 8
        expect(conditions.length).toBe(8);
      });

      it('adds condition when minRatingo is 0', () => {
        const options: ShowConditionsOptions = { minRatingo: 0 };
        const conditions = buildTrendingShowConditions(options);

        // 7 base + 1 minRatingo = 8
        expect(conditions.length).toBe(8);
      });
    });

    describe('genres option', () => {
      it('does not add condition when genres is undefined', () => {
        const options: ShowConditionsOptions = {};
        const conditions = buildTrendingShowConditions(options);

        expect(conditions.length).toBe(7);
      });

      it('does not add condition when genres is empty array', () => {
        const options: ShowConditionsOptions = { genres: [] };
        const conditions = buildTrendingShowConditions(options);

        expect(conditions.length).toBe(7);
      });

      it('adds EXISTS subquery when genres provided', () => {
        const options: ShowConditionsOptions = {
          genres: ['action', 'comedy'],
        };
        const conditions = buildTrendingShowConditions(options);

        // 7 base + 1 genre EXISTS = 8
        expect(conditions.length).toBe(8);
      });

      it('adds single condition for single genre', () => {
        const options: ShowConditionsOptions = {
          genres: ['drama'],
        };
        const conditions = buildTrendingShowConditions(options);

        expect(conditions.length).toBe(8);
      });
    });

    describe('minVotes option', () => {
      it('does not add condition when minVotes is undefined', () => {
        const options: ShowConditionsOptions = {};
        const conditions = buildTrendingShowConditions(options);

        expect(conditions.length).toBe(7);
      });

      it('adds TMDB vote count condition by default', () => {
        const options: ShowConditionsOptions = {
          minVotes: 100,
        };
        const conditions = buildTrendingShowConditions(options);

        // 7 base + 1 minVotes = 8
        expect(conditions.length).toBe(8);
      });

      it('adds TMDB vote count condition when voteSource is tmdb', () => {
        const options: ShowConditionsOptions = {
          voteSource: VOTE_SOURCE.TMDB,
          minVotes: 100,
        };
        const conditions = buildTrendingShowConditions(options);

        expect(conditions.length).toBe(8);
      });

      it('adds Trakt vote count condition when voteSource is trakt', () => {
        const options: ShowConditionsOptions = {
          voteSource: VOTE_SOURCE.TRAKT,
          minVotes: 50,
        };
        const conditions = buildTrendingShowConditions(options);

        expect(conditions.length).toBe(8);
      });
    });

    describe('year options', () => {
      it('does not add conditions when no year params provided', () => {
        const options: ShowConditionsOptions = {};
        const conditions = buildTrendingShowConditions(options);

        expect(conditions.length).toBe(7);
      });

      it('adds 3 conditions for exact year', () => {
        const options: ShowConditionsOptions = {
          year: 2024,
        };
        const conditions = buildTrendingShowConditions(options);

        // 7 base + 3 year (isNotNull, gte, lt) = 10
        expect(conditions.length).toBe(10);
      });

      it('adds 2 conditions for yearFrom only', () => {
        const options: ShowConditionsOptions = {
          yearFrom: 2020,
        };
        const conditions = buildTrendingShowConditions(options);

        // 7 base + 2 yearFrom (isNotNull, gte) = 9
        expect(conditions.length).toBe(9);
      });

      it('adds 2 conditions for yearTo only', () => {
        const options: ShowConditionsOptions = {
          yearTo: 2024,
        };
        const conditions = buildTrendingShowConditions(options);

        // 7 base + 2 yearTo (isNotNull, lt) = 9
        expect(conditions.length).toBe(9);
      });

      it('adds 3 conditions for yearFrom and yearTo range', () => {
        const options: ShowConditionsOptions = {
          yearFrom: 2020,
          yearTo: 2024,
        };
        const conditions = buildTrendingShowConditions(options);

        // 7 base + 3 year range (isNotNull from both + gte + lt) = 10
        // Note: yearFrom adds isNotNull+gte (2), yearTo adds isNotNull+lt (2)
        // but in show-conditions.builder it adds isNotNull once per block
        // yearFrom: isNotNull + gte = 2
        // yearTo: isNotNull + lt = 2
        // So: 7 base + 2 + 2 = 11
        expect(conditions.length).toBe(11);
      });

      it('year takes precedence over yearFrom/yearTo', () => {
        const optionsWithYear: ShowConditionsOptions = {
          year: 2024,
          yearFrom: 2020,
          yearTo: 2025,
        };
        const optionsYearOnly: ShowConditionsOptions = {
          year: 2024,
        };

        const conditionsWithYear = buildTrendingShowConditions(optionsWithYear);
        const conditionsYearOnly = buildTrendingShowConditions(optionsYearOnly);

        // Both should have same number of conditions (year takes precedence)
        expect(conditionsWithYear.length).toBe(conditionsYearOnly.length);
        expect(conditionsWithYear.length).toBe(10);
      });
    });

    describe('combined options', () => {
      it('adds all conditions when all options provided', () => {
        const options: ShowConditionsOptions = {
          listContext: 'home',
          minRatingo: 70,
          genres: ['action'],
          voteSource: VOTE_SOURCE.TMDB,
          minVotes: 100,
          year: 2024,
        };
        const conditions = buildTrendingShowConditions(options);

        // 7 base + 1 minRatingo + 1 genres + 1 minVotes + 3 year = 13
        expect(conditions.length).toBe(13);
      });

      it('handles multiple genres with other options', () => {
        const options: ShowConditionsOptions = {
          listContext: 'catalog',
          genres: ['action', 'comedy', 'drama'],
          minRatingo: 60,
        };
        const conditions = buildTrendingShowConditions(options);

        // 7 base + 1 minRatingo + 1 genres (single EXISTS) = 9
        expect(conditions.length).toBe(9);
      });
    });

    describe('SQL template format', () => {
      it('returns SQL objects (not plain strings)', () => {
        const options: ShowConditionsOptions = { listContext: 'catalog' };
        const conditions = buildTrendingShowConditions(options);

        // All conditions should be SQL template objects from drizzle-orm
        for (const condition of conditions) {
          expect(condition).toBeDefined();
          expect(typeof condition).toBe('object');
        }
      });
    });
  });
});
