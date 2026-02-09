import type { SQL } from 'drizzle-orm';

import { CATALOG_SORT, SORT_ORDER } from '../../../domain/constants/catalog-query.constants';

import { buildMovieSortOrder, buildShowSortOrder } from './sort-order.builder';

/**
 * Recursively extract all raw string values from a Drizzle SQL expression.
 * Used to assert column references in generated SQL.
 */
function getSqlStrings(expression: SQL): string {
  const strings: string[] = [];
  function extract(obj: unknown): void {
    if (!obj || typeof obj !== 'object') return;
    if ('value' in obj && Array.isArray((obj as { value: unknown[] }).value)) {
      for (const v of (obj as { value: string[] }).value) {
        if (typeof v === 'string') strings.push(v);
      }
    }
    if ('queryChunks' in obj && Array.isArray((obj as { queryChunks: unknown[] }).queryChunks)) {
      for (const chunk of (obj as { queryChunks: unknown[] }).queryChunks) {
        extract(chunk);
      }
    }
  }
  extract(expression);
  return strings.join('').toLowerCase();
}

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

      it('returns SQL expressions for lastAirDate sort (falls back to releaseDate)', () => {
        const lastAirDateResult = buildMovieSortOrder(CATALOG_SORT.LAST_AIR_DATE, SORT_ORDER.DESC);
        const releaseDateResult = buildMovieSortOrder(CATALOG_SORT.RELEASE_DATE, SORT_ORDER.DESC);

        expect(lastAirDateResult).toHaveLength(2);
        // Movies don't have last_air_date, so lastAirDate produces same SQL as releaseDate
        expect(lastAirDateResult).toEqual(releaseDateResult);
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
          CATALOG_SORT.LAST_AIR_DATE,
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

  describe('buildShowSortOrder', () => {
    describe('sort options', () => {
      it('returns SQL expression for trending sort', () => {
        const result = buildShowSortOrder(CATALOG_SORT.TRENDING, SORT_ORDER.DESC);

        // Show sort returns a single SQL expression (not array) with embedded tiebreaker
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
      });

      it('returns SQL expression for ratingo sort', () => {
        const result = buildShowSortOrder(CATALOG_SORT.RATINGO, SORT_ORDER.DESC);

        expect(result).toBeDefined();
      });

      it('sorts by premiere date for releaseDate (not last_air_date)', () => {
        const result = buildShowSortOrder(CATALOG_SORT.RELEASE_DATE, SORT_ORDER.DESC);
        const sqlStr = getSqlStrings(result);

        expect(result).toBeDefined();
        expect(sqlStr).toContain('mi.release_date');
        expect(sqlStr).not.toContain('s.last_air_date');
      });

      it('sorts by last episode air date for lastAirDate', () => {
        const result = buildShowSortOrder(CATALOG_SORT.LAST_AIR_DATE, SORT_ORDER.DESC);
        const sqlStr = getSqlStrings(result);

        expect(result).toBeDefined();
        expect(sqlStr).toContain('s.last_air_date');
      });

      it('produces different SQL for releaseDate vs lastAirDate', () => {
        const releaseDate = buildShowSortOrder(CATALOG_SORT.RELEASE_DATE, SORT_ORDER.DESC);
        const lastAirDate = buildShowSortOrder(CATALOG_SORT.LAST_AIR_DATE, SORT_ORDER.DESC);

        expect(getSqlStrings(releaseDate)).not.toEqual(getSqlStrings(lastAirDate));
      });

      it('returns SQL expression for tmdbPopularity sort', () => {
        const result = buildShowSortOrder(CATALOG_SORT.TMDB_POPULARITY, SORT_ORDER.DESC);

        expect(result).toBeDefined();
      });

      it('returns SQL expression for popularity sort (default)', () => {
        const result = buildShowSortOrder(CATALOG_SORT.POPULARITY, SORT_ORDER.DESC);

        expect(result).toBeDefined();
      });
    });

    describe('sort order direction', () => {
      it('accepts ascending order', () => {
        const result = buildShowSortOrder(CATALOG_SORT.RATINGO, SORT_ORDER.ASC);

        expect(result).toBeDefined();
      });

      it('accepts descending order', () => {
        const result = buildShowSortOrder(CATALOG_SORT.RATINGO, SORT_ORDER.DESC);

        expect(result).toBeDefined();
      });
    });

    describe('all sort values are handled', () => {
      it('handles all CATALOG_SORT values without throwing', () => {
        const allSortValues = Object.values(CATALOG_SORT);

        for (const sort of allSortValues) {
          expect(() => buildShowSortOrder(sort, SORT_ORDER.DESC)).not.toThrow();
          expect(() => buildShowSortOrder(sort, SORT_ORDER.ASC)).not.toThrow();
        }
      });
    });

    describe('return type', () => {
      it('returns single SQL expression (not array) for raw SQL query compatibility', () => {
        const sortOptions = [
          CATALOG_SORT.TRENDING,
          CATALOG_SORT.RATINGO,
          CATALOG_SORT.RELEASE_DATE,
          CATALOG_SORT.LAST_AIR_DATE,
          CATALOG_SORT.TMDB_POPULARITY,
          CATALOG_SORT.POPULARITY,
        ] as const;

        for (const sort of sortOptions) {
          const result = buildShowSortOrder(sort, SORT_ORDER.DESC);
          // Should not be an array (unlike buildMovieSortOrder)
          expect(Array.isArray(result)).toBe(false);
          expect(result).toBeDefined();
        }
      });
    });
  });
});
