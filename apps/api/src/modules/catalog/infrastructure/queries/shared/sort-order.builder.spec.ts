import { CATALOG_SORT, SORT_ORDER } from '../../../domain/constants/catalog-query.constants';

import { buildMovieSortOrder } from './sort-order.builder';

describe('sort-order.builder', () => {
  describe('buildMovieSortOrder', () => {
    describe('sort options', () => {
      it('returns SQL expressions for trending sort', () => {
        const result = buildMovieSortOrder(CATALOG_SORT.TRENDING, SORT_ORDER.DESC);

        expect(result).toHaveLength(2);
        // First expression is the trending formula, second is the tiebreaker
        expect(result[0]).toBeDefined();
        expect(result[1]).toBeDefined();
      });

      it('returns SQL expressions for ratingo sort', () => {
        const result = buildMovieSortOrder(CATALOG_SORT.RATINGO, SORT_ORDER.DESC);

        expect(result).toHaveLength(2);
        expect(result[0]).toBeDefined();
        expect(result[1]).toBeDefined();
      });

      it('returns SQL expressions for releaseDate sort', () => {
        const result = buildMovieSortOrder(CATALOG_SORT.RELEASE_DATE, SORT_ORDER.DESC);

        expect(result).toHaveLength(2);
        expect(result[0]).toBeDefined();
        expect(result[1]).toBeDefined();
      });

      it('returns SQL expressions for tmdbPopularity sort', () => {
        const result = buildMovieSortOrder(CATALOG_SORT.TMDB_POPULARITY, SORT_ORDER.DESC);

        expect(result).toHaveLength(2);
        expect(result[0]).toBeDefined();
        expect(result[1]).toBeDefined();
      });

      it('returns SQL expressions for popularity sort (default)', () => {
        const result = buildMovieSortOrder(CATALOG_SORT.POPULARITY, SORT_ORDER.DESC);

        expect(result).toHaveLength(2);
        expect(result[0]).toBeDefined();
        expect(result[1]).toBeDefined();
      });
    });

    describe('sort order direction', () => {
      it('accepts ascending order', () => {
        const result = buildMovieSortOrder(CATALOG_SORT.RATINGO, SORT_ORDER.ASC);

        expect(result).toHaveLength(2);
      });

      it('accepts descending order', () => {
        const result = buildMovieSortOrder(CATALOG_SORT.RATINGO, SORT_ORDER.DESC);

        expect(result).toHaveLength(2);
      });
    });

    describe('tiebreaker', () => {
      it('always includes id-based tiebreaker as second element', () => {
        const sortOptions = [
          CATALOG_SORT.TRENDING,
          CATALOG_SORT.RATINGO,
          CATALOG_SORT.RELEASE_DATE,
          CATALOG_SORT.TMDB_POPULARITY,
          CATALOG_SORT.POPULARITY,
        ] as const;

        for (const sort of sortOptions) {
          const result = buildMovieSortOrder(sort, SORT_ORDER.DESC);
          expect(result).toHaveLength(2);
          // Second element should be the tiebreaker (id desc)
          expect(result[1]).toBeDefined();
        }
      });
    });

    describe('all sort values are handled', () => {
      it('handles all CATALOG_SORT values without throwing', () => {
        const allSortValues = Object.values(CATALOG_SORT);

        for (const sort of allSortValues) {
          expect(() => buildMovieSortOrder(sort, SORT_ORDER.DESC)).not.toThrow();
          expect(() => buildMovieSortOrder(sort, SORT_ORDER.ASC)).not.toThrow();
        }
      });
    });
  });
});
