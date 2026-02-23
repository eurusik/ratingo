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
        alternativeTitles: null,
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
        matchedAlternativeTitle: null,
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
        isImported: false,
        alternativeTitles: null,
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
        matchedAlternativeTitle: null,
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
        alternativeTitles: null,
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
            alternativeTitles: null,
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
            isImported: false,
            alternativeTitles: null,
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

    it('should set matchedAlternativeTitle when alt title matches query', () => {
      const localItem: LocalSearchResultItem = {
        source: SEARCH_SOURCE.LOCAL,
        type: MediaType.SHOW,
        id: 'uuid-456',
        slug: 'invincible',
        tmdbId: 95557,
        title: 'НЕПЕРЕМОЖНИЙ',
        originalTitle: 'Invincible',
        alternativeTitles: ['Невразливий', 'Невколупний'],
        year: 2021,
        posterPath: '/invincible.jpg',
        rating: 8.5,
      };

      const input: HybridSearchResult = {
        query: 'Невразливий',
        local: [localItem],
        tmdb: [],
      };

      const result = SearchMapper.toResponseDto(input);

      expect(result.local[0].matchedAlternativeTitle).toBe('Невразливий');
    });

    it('should match via reverse containment (query contains alt title)', () => {
      const localItem: LocalSearchResultItem = {
        source: SEARCH_SOURCE.LOCAL,
        type: MediaType.SHOW,
        id: 'uuid-456',
        slug: 'invincible',
        tmdbId: 95557,
        title: 'НЕПЕРЕМОЖНИЙ',
        originalTitle: 'Invincible',
        alternativeTitles: ['Невразливий', 'Невколупний'],
        year: 2021,
        posterPath: '/invincible.jpg',
        rating: 8.5,
      };

      const input: HybridSearchResult = {
        query: 'Невразливий серіал',
        local: [localItem],
        tmdb: [],
      };

      const result = SearchMapper.toResponseDto(input);

      expect(result.local[0].matchedAlternativeTitle).toBe('Невразливий');
    });

    it('should set matchedAlternativeTitle to null for TMDB results without alt titles', () => {
      const input: HybridSearchResult = {
        query: 'test',
        local: [],
        tmdb: [
          {
            source: SEARCH_SOURCE.TMDB,
            type: MediaType.MOVIE,
            tmdbId: 123,
            title: 'Test Movie',
            originalTitle: 'Test Movie',
            year: 2024,
            posterPath: null,
            rating: 7,
            isImported: false,
            alternativeTitles: null,
          },
        ],
      };

      const result = SearchMapper.toResponseDto(input);

      expect(result.tmdb[0].matchedAlternativeTitle).toBeNull();
    });

    it('should compute matchedAlternativeTitle for TMDB results with alt titles', () => {
      const input: HybridSearchResult = {
        query: 'In the Mud',
        local: [],
        tmdb: [
          {
            source: SEARCH_SOURCE.TMDB,
            type: MediaType.MOVIE,
            tmdbId: 258462,
            title: 'У багні',
            originalTitle: 'У багні',
            year: 2024,
            posterPath: '/mud.jpg',
            rating: 6.5,
            isImported: false,
            alternativeTitles: ['In the Mud', 'В грязи'],
          },
        ],
      };

      const result = SearchMapper.toResponseDto(input);

      expect(result.tmdb[0].matchedAlternativeTitle).toBe('In the Mud');
    });

    it('should not show complementary alt title for local results', () => {
      const localItem: LocalSearchResultItem = {
        source: SEARCH_SOURCE.LOCAL,
        type: MediaType.SHOW,
        id: 'uuid-456',
        slug: 'invincible',
        tmdbId: 95557,
        title: 'НЕПЕРЕМОЖНИЙ',
        originalTitle: 'Invincible',
        alternativeTitles: ['Невразливий', 'Невколупний'],
        year: 2021,
        posterPath: '/invincible.jpg',
        rating: 8.5,
      };

      const input: HybridSearchResult = {
        query: 'НЕПЕРЕМОЖНИЙ',
        local: [localItem],
        tmdb: [],
      };

      const result = SearchMapper.toResponseDto(input);

      // Local: title matched directly → no complementary fallback (avoids noise)
      expect(result.local[0].matchedAlternativeTitle).toBeNull();
    });

    it('should show complementary alt title for TMDB item when query matches title', () => {
      const input: HybridSearchResult = {
        query: 'У багні',
        local: [],
        tmdb: [
          {
            source: SEARCH_SOURCE.TMDB,
            type: MediaType.MOVIE,
            tmdbId: 258462,
            title: 'У багні',
            originalTitle: 'У багні',
            year: 2024,
            posterPath: '/mud.jpg',
            rating: 6.5,
            isImported: false,
            alternativeTitles: ['In the Mud', 'В грязи'],
          },
        ],
      };

      const result = SearchMapper.toResponseDto(input);

      // Query matches title directly → complementary picks Latin-script alt
      expect(result.tmdb[0].matchedAlternativeTitle).toBe('In the Mud');
    });

    it('should NOT show complementary title when query does not match title or originalTitle', () => {
      const input: HybridSearchResult = {
        query: 'Batman',
        local: [],
        tmdb: [
          {
            source: SEARCH_SOURCE.TMDB,
            type: MediaType.MOVIE,
            tmdbId: 49026,
            title: 'The Dark Knight Rises',
            originalTitle: 'The Dark Knight Rises',
            year: 2012,
            posterPath: '/tdkr.jpg',
            rating: 8.4,
            isImported: false,
            alternativeTitles: ['El Caballero Oscuro'],
          },
        ],
      };

      const result = SearchMapper.toResponseDto(input);

      // Query "Batman" doesn't match title/originalTitle "The Dark Knight Rises",
      // and alt title "El Caballero Oscuro" doesn't match query either → null
      expect(result.tmdb[0].matchedAlternativeTitle).toBeNull();
    });

    it('should prefer Latin-script complementary title over Cyrillic', () => {
      const input: HybridSearchResult = {
        query: 'テスト映画',
        local: [],
        tmdb: [
          {
            source: SEARCH_SOURCE.TMDB,
            type: MediaType.MOVIE,
            tmdbId: 999,
            title: 'テスト映画',
            originalTitle: 'テスト映画',
            year: 2024,
            posterPath: null,
            rating: 7,
            isImported: false,
            alternativeTitles: ['Тестовий фільм', 'Test Movie', 'Película de prueba'],
          },
        ],
      };

      const result = SearchMapper.toResponseDto(input);

      // Skips Cyrillic "Тестовий фільм", picks first Latin "Test Movie"
      expect(result.tmdb[0].matchedAlternativeTitle).toBe('Test Movie');
    });

    it('should fall back to first non-title alt when no Latin available', () => {
      const input: HybridSearchResult = {
        query: 'テスト映画',
        local: [],
        tmdb: [
          {
            source: SEARCH_SOURCE.TMDB,
            type: MediaType.MOVIE,
            tmdbId: 999,
            title: 'テスト映画',
            originalTitle: 'テスト映画',
            year: 2024,
            posterPath: null,
            rating: 7,
            isImported: false,
            alternativeTitles: ['Тестовий фільм', 'Тестовый фильм'],
          },
        ],
      };

      const result = SearchMapper.toResponseDto(input);

      // No Latin alt → falls back to first candidate
      expect(result.tmdb[0].matchedAlternativeTitle).toBe('Тестовий фільм');
    });
  });
});
