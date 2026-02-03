import { MediaType } from '@/common/enums/media-type.enum';

import {
  HybridSearchResult,
  LocalSearchResultItem,
  SEARCH_SOURCE,
  TmdbSearchResultItem,
} from '../../domain/types/search.types';

import { SearchMapper } from './search.mapper';

describe('SearchMapper', () => {
  describe('toResponseDto', () => {
    it('should map empty results', () => {
      const input: HybridSearchResult = {
        query: 'test',
        local: [],
        tmdb: [],
      };

      const result = SearchMapper.toResponseDto(input);

      expect(result.query).toBe('test');
      expect(result.local).toEqual([]);
      expect(result.tmdb).toEqual([]);
    });

    it('should map local results with poster URLs and isImported=true', () => {
      const localItem: LocalSearchResultItem = {
        source: SEARCH_SOURCE.LOCAL,
        type: MediaType.MOVIE,
        id: 'uuid-123',
        slug: 'the-matrix',
        tmdbId: 603,
        title: 'The Matrix',
        originalTitle: 'The Matrix',
        year: 1999,
        posterPath: '/poster.jpg',
        rating: 8.7,
      };

      const input: HybridSearchResult = {
        query: 'matrix',
        local: [localItem],
        tmdb: [],
      };

      const result = SearchMapper.toResponseDto(input);

      expect(result.local).toHaveLength(1);
      expect(result.local[0]).toEqual({
        source: 'local',
        type: MediaType.MOVIE,
        id: 'uuid-123',
        mediaItemId: 'uuid-123',
        slug: 'the-matrix',
        tmdbId: 603,
        title: 'The Matrix',
        originalTitle: 'The Matrix',
        year: 1999,
        poster: {
          small: 'https://image.tmdb.org/t/p/w342/poster.jpg',
          medium: 'https://image.tmdb.org/t/p/w500/poster.jpg',
          large: 'https://image.tmdb.org/t/p/w780/poster.jpg',
          original: 'https://image.tmdb.org/t/p/original/poster.jpg',
        },
        rating: 8.7,
        isImported: true,
      });
    });

    it('should map TMDB results with poster URLs and isImported=false', () => {
      const tmdbItem: TmdbSearchResultItem = {
        source: SEARCH_SOURCE.TMDB,
        type: MediaType.SHOW,
        tmdbId: 1399,
        title: 'Game of Thrones',
        originalTitle: 'Game of Thrones',
        year: 2011,
        posterPath: '/got.jpg',
        rating: 9.3,
      };

      const input: HybridSearchResult = {
        query: 'game',
        local: [],
        tmdb: [tmdbItem],
      };

      const result = SearchMapper.toResponseDto(input);

      expect(result.tmdb).toHaveLength(1);
      expect(result.tmdb[0]).toEqual({
        source: 'tmdb',
        type: MediaType.SHOW,
        tmdbId: 1399,
        title: 'Game of Thrones',
        originalTitle: 'Game of Thrones',
        year: 2011,
        poster: {
          small: 'https://image.tmdb.org/t/p/w342/got.jpg',
          medium: 'https://image.tmdb.org/t/p/w500/got.jpg',
          large: 'https://image.tmdb.org/t/p/w780/got.jpg',
          original: 'https://image.tmdb.org/t/p/original/got.jpg',
        },
        rating: 9.3,
        isImported: false,
      });
    });

    it('should handle null posterPath', () => {
      const localItem: LocalSearchResultItem = {
        source: SEARCH_SOURCE.LOCAL,
        type: MediaType.MOVIE,
        id: 'uuid-123',
        slug: 'no-poster',
        tmdbId: 999,
        title: 'No Poster Movie',
        originalTitle: null,
        year: null,
        posterPath: null,
        rating: 0,
      };

      const input: HybridSearchResult = {
        query: 'no poster',
        local: [localItem],
        tmdb: [],
      };

      const result = SearchMapper.toResponseDto(input);

      expect(result.local[0].poster).toBeNull();
      expect(result.local[0].originalTitle).toBeNull();
      expect(result.local[0].year).toBeNull();
    });

    it('should map both local and TMDB results together', () => {
      const input: HybridSearchResult = {
        query: 'batman',
        local: [
          {
            source: SEARCH_SOURCE.LOCAL,
            type: MediaType.MOVIE,
            id: 'local-1',
            slug: 'batman-begins',
            tmdbId: 272,
            title: 'Batman Begins',
            originalTitle: 'Batman Begins',
            year: 2005,
            posterPath: '/batman1.jpg',
            rating: 8.2,
          },
        ],
        tmdb: [
          {
            source: SEARCH_SOURCE.TMDB,
            type: MediaType.MOVIE,
            tmdbId: 155,
            title: 'The Dark Knight',
            originalTitle: 'The Dark Knight',
            year: 2008,
            posterPath: '/batman2.jpg',
            rating: 9.0,
          },
        ],
      };

      const result = SearchMapper.toResponseDto(input);

      expect(result.query).toBe('batman');
      expect(result.local).toHaveLength(1);
      expect(result.tmdb).toHaveLength(1);
      expect(result.local[0].isImported).toBe(true);
      expect(result.tmdb[0].isImported).toBe(false);
    });
  });
});
