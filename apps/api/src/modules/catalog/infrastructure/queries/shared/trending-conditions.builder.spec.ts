import {
  buildTrendingMovieConditions,
  type TrendingMovieConditionsOptions,
} from './trending-conditions.builder';
import {
  CONTEXT_FRESHNESS,
  TRENDING_THRESHOLDS,
} from '../../../domain/constants/catalog.constants';
import { VOTE_SOURCE } from '../../../domain/constants/catalog-query.constants';

// Mock the database instance - we only need it for genre subquery construction
const mockDb = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
} as never;

describe('trending-conditions.builder', () => {
  describe('buildTrendingMovieConditions', () => {
    describe('base conditions', () => {
      it('returns array of SQL conditions', () => {
        const options: TrendingMovieConditionsOptions = { context: 'catalog' };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        expect(Array.isArray(conditions)).toBe(true);
        expect(conditions.length).toBeGreaterThan(0);
      });

      it('includes base conditions for catalog context', () => {
        const options: TrendingMovieConditionsOptions = { context: 'catalog' };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        // Base conditions:
        // 1. popularityScore IS NOT NULL
        // 2. status = ELIGIBLE
        // 3. context = TRENDING
        // 4. ingestionStatus = READY
        // 5. deletedAt IS NULL
        // 6. freshnessScore >= threshold (if > 0)
        // 7. watchersCount >= MIN_WATCHERS_MOVIES
        // Catalog context has freshnessThreshold = 30 (> 0), so 7 conditions
        expect(conditions.length).toBeGreaterThanOrEqual(7);
      });

      it('includes base conditions for home context', () => {
        const options: TrendingMovieConditionsOptions = { context: 'home' };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        // Home context has freshnessThreshold = 50 (> 0), so same structure
        expect(conditions.length).toBeGreaterThanOrEqual(7);
      });
    });

    describe('freshness threshold', () => {
      it('adds freshness condition for home context', () => {
        const options: TrendingMovieConditionsOptions = { context: 'home' };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        // Home context has MIN_FRESHNESS = 50 threshold
        expect(CONTEXT_FRESHNESS.home.trending).toBe(TRENDING_THRESHOLDS.MIN_FRESHNESS);
        expect(conditions.length).toBeGreaterThanOrEqual(7);
      });

      it('adds freshness condition for catalog context', () => {
        const options: TrendingMovieConditionsOptions = { context: 'catalog' };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        // Catalog context has MIN_FRESHNESS_POPULARITY = 30 threshold
        expect(CONTEXT_FRESHNESS.catalog.trending).toBe(
          TRENDING_THRESHOLDS.MIN_FRESHNESS_POPULARITY,
        );
        expect(conditions.length).toBeGreaterThanOrEqual(7);
      });
    });

    describe('minimum watchers condition', () => {
      it('always includes minimum watchers condition', () => {
        const options: TrendingMovieConditionsOptions = { context: 'catalog' };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        // MIN_WATCHERS_MOVIES = 2
        expect(TRENDING_THRESHOLDS.MIN_WATCHERS_MOVIES).toBe(2);
        // Condition is always added (7th base condition)
        expect(conditions.length).toBeGreaterThanOrEqual(7);
      });
    });

    describe('minRatingo option', () => {
      it('does not add condition when minRatingo is undefined', () => {
        const optionsWithout: TrendingMovieConditionsOptions = { context: 'catalog' };
        const optionsWith: TrendingMovieConditionsOptions = { context: 'catalog', minRatingo: 70 };

        const conditionsWithout = buildTrendingMovieConditions(mockDb, optionsWithout);
        const conditionsWith = buildTrendingMovieConditions(mockDb, optionsWith);

        expect(conditionsWith.length).toBe(conditionsWithout.length + 1);
      });

      it('adds condition when minRatingo is provided', () => {
        const options: TrendingMovieConditionsOptions = { context: 'catalog', minRatingo: 80 };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        // 7 base + 1 minRatingo = 8
        expect(conditions.length).toBe(8);
      });

      it('adds condition when minRatingo is 0', () => {
        const options: TrendingMovieConditionsOptions = { context: 'catalog', minRatingo: 0 };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        // 7 base + 1 minRatingo = 8
        expect(conditions.length).toBe(8);
      });
    });

    describe('genres option', () => {
      it('does not add condition when genres is undefined', () => {
        const options: TrendingMovieConditionsOptions = { context: 'catalog' };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        expect(conditions.length).toBe(7);
      });

      it('does not add condition when genres is empty array', () => {
        const options: TrendingMovieConditionsOptions = { context: 'catalog', genres: [] };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        expect(conditions.length).toBe(7);
      });

      it('adds EXISTS subquery when genres provided', () => {
        const options: TrendingMovieConditionsOptions = {
          context: 'catalog',
          genres: ['action', 'comedy'],
        };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        // 7 base + 1 genre EXISTS = 8
        expect(conditions.length).toBe(8);
      });

      it('adds single condition for single genre', () => {
        const options: TrendingMovieConditionsOptions = {
          context: 'catalog',
          genres: ['drama'],
        };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        expect(conditions.length).toBe(8);
      });
    });

    describe('minVotes option', () => {
      it('does not add condition when minVotes is undefined', () => {
        const options: TrendingMovieConditionsOptions = { context: 'catalog' };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        expect(conditions.length).toBe(7);
      });

      it('adds TMDB vote count condition by default', () => {
        const options: TrendingMovieConditionsOptions = {
          context: 'catalog',
          minVotes: 100,
        };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        // 7 base + 1 minVotes = 8
        expect(conditions.length).toBe(8);
      });

      it('adds TMDB vote count condition when voteSource is tmdb', () => {
        const options: TrendingMovieConditionsOptions = {
          context: 'catalog',
          voteSource: VOTE_SOURCE.TMDB,
          minVotes: 100,
        };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        expect(conditions.length).toBe(8);
      });

      it('adds Trakt vote count condition when voteSource is trakt', () => {
        const options: TrendingMovieConditionsOptions = {
          context: 'catalog',
          voteSource: VOTE_SOURCE.TRAKT,
          minVotes: 50,
        };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        expect(conditions.length).toBe(8);
      });
    });

    describe('year options', () => {
      it('does not add conditions when no year params provided', () => {
        const options: TrendingMovieConditionsOptions = { context: 'catalog' };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        expect(conditions.length).toBe(7);
      });

      it('adds 3 conditions for exact year', () => {
        const options: TrendingMovieConditionsOptions = {
          context: 'catalog',
          year: 2024,
        };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        // 7 base + 3 year (isNotNull, gte, lt) = 10
        expect(conditions.length).toBe(10);
      });

      it('adds 2 conditions for yearFrom only', () => {
        const options: TrendingMovieConditionsOptions = {
          context: 'catalog',
          yearFrom: 2020,
        };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        // 7 base + 2 yearFrom (isNotNull, gte) = 9
        expect(conditions.length).toBe(9);
      });

      it('adds 2 conditions for yearTo only', () => {
        const options: TrendingMovieConditionsOptions = {
          context: 'catalog',
          yearTo: 2024,
        };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        // 7 base + 2 yearTo (isNotNull, lt) = 9
        expect(conditions.length).toBe(9);
      });

      it('adds 3 conditions for yearFrom and yearTo range', () => {
        const options: TrendingMovieConditionsOptions = {
          context: 'catalog',
          yearFrom: 2020,
          yearTo: 2024,
        };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        // 7 base + 3 year range (isNotNull, gte, lt) = 10
        expect(conditions.length).toBe(10);
      });

      it('year takes precedence over yearFrom/yearTo', () => {
        const optionsWithYear: TrendingMovieConditionsOptions = {
          context: 'catalog',
          year: 2024,
          yearFrom: 2020,
          yearTo: 2025,
        };
        const optionsYearOnly: TrendingMovieConditionsOptions = {
          context: 'catalog',
          year: 2024,
        };

        const conditionsWithYear = buildTrendingMovieConditions(mockDb, optionsWithYear);
        const conditionsYearOnly = buildTrendingMovieConditions(mockDb, optionsYearOnly);

        // Both should have same number of conditions (year takes precedence)
        expect(conditionsWithYear.length).toBe(conditionsYearOnly.length);
        expect(conditionsWithYear.length).toBe(10);
      });
    });

    describe('combined options', () => {
      it('adds all conditions when all options provided', () => {
        const options: TrendingMovieConditionsOptions = {
          context: 'home',
          minRatingo: 70,
          genres: ['action'],
          voteSource: VOTE_SOURCE.TMDB,
          minVotes: 100,
          year: 2024,
        };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        // 7 base + 1 minRatingo + 1 genres + 1 minVotes + 3 year = 13
        expect(conditions.length).toBe(13);
      });

      it('handles multiple genres with other options', () => {
        const options: TrendingMovieConditionsOptions = {
          context: 'catalog',
          genres: ['action', 'comedy', 'drama'],
          minRatingo: 60,
        };
        const conditions = buildTrendingMovieConditions(mockDb, options);

        // 7 base + 1 minRatingo + 1 genres (single EXISTS) = 9
        expect(conditions.length).toBe(9);
      });
    });
  });
});
