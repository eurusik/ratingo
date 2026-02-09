import {
  CATALOG_SORT,
  CATALOG_SORT_VALUES,
  type CatalogSort,
  SORT_ORDER,
  type SortOrder,
  VOTE_SOURCE,
  type VoteSource,
} from './catalog-query.constants';

describe('catalog-query.constants', () => {
  describe('CATALOG_SORT', () => {
    it('contains all expected sort options', () => {
      expect(CATALOG_SORT.TRENDING).toBe('trending');
      expect(CATALOG_SORT.POPULARITY).toBe('popularity');
      expect(CATALOG_SORT.RATINGO).toBe('ratingo');
      expect(CATALOG_SORT.RELEASE_DATE).toBe('releaseDate');
      expect(CATALOG_SORT.LAST_AIR_DATE).toBe('lastAirDate');
      expect(CATALOG_SORT.TMDB_POPULARITY).toBe('tmdbPopularity');
    });

    it('has exactly 6 sort options', () => {
      expect(Object.keys(CATALOG_SORT)).toHaveLength(6);
    });
  });

  describe('CATALOG_SORT_VALUES', () => {
    it('contains all values from CATALOG_SORT', () => {
      expect(CATALOG_SORT_VALUES).toContain('trending');
      expect(CATALOG_SORT_VALUES).toContain('popularity');
      expect(CATALOG_SORT_VALUES).toContain('ratingo');
      expect(CATALOG_SORT_VALUES).toContain('releaseDate');
      expect(CATALOG_SORT_VALUES).toContain('lastAirDate');
      expect(CATALOG_SORT_VALUES).toContain('tmdbPopularity');
    });

    it('has the same length as CATALOG_SORT keys', () => {
      expect(CATALOG_SORT_VALUES).toHaveLength(Object.keys(CATALOG_SORT).length);
    });

    it('can be used for type validation', () => {
      const validSort: CatalogSort = 'trending';
      expect(CATALOG_SORT_VALUES).toContain(validSort);
    });
  });

  describe('SORT_ORDER', () => {
    it('contains ascending and descending options', () => {
      expect(SORT_ORDER.ASC).toBe('asc');
      expect(SORT_ORDER.DESC).toBe('desc');
    });

    it('has exactly 2 order options', () => {
      expect(Object.keys(SORT_ORDER)).toHaveLength(2);
    });

    it('values match SortOrder type', () => {
      const ascOrder: SortOrder = SORT_ORDER.ASC;
      const descOrder: SortOrder = SORT_ORDER.DESC;
      expect(ascOrder).toBe('asc');
      expect(descOrder).toBe('desc');
    });
  });

  describe('VOTE_SOURCE', () => {
    it('contains tmdb and trakt options', () => {
      expect(VOTE_SOURCE.TMDB).toBe('tmdb');
      expect(VOTE_SOURCE.TRAKT).toBe('trakt');
    });

    it('has exactly 2 vote source options', () => {
      expect(Object.keys(VOTE_SOURCE)).toHaveLength(2);
    });

    it('values match VoteSource type', () => {
      const tmdbSource: VoteSource = VOTE_SOURCE.TMDB;
      const traktSource: VoteSource = VOTE_SOURCE.TRAKT;
      expect(tmdbSource).toBe('tmdb');
      expect(traktSource).toBe('trakt');
    });
  });
});
