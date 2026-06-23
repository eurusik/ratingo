import { Test, TestingModule } from '@nestjs/testing';
import { TmdbAdapter } from './tmdb.adapter';
import tmdbConfig from '@/config/tmdb.config';
import { MediaType } from '@/common/enums/media-type.enum';
import { TmdbApiException } from '@/common/exceptions';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock TmdbMapper - can be configured per test
const mockToDomain = jest.fn();

jest.mock('./mappers/tmdb.mapper', () => {
  const actual = jest.requireActual('./mappers/tmdb.mapper');
  return {
    TmdbMapper: {
      toDomain: (data: any, type: any) => mockToDomain(data, type),
      // Use the real person mapper so getPerson tests exercise actual mapping.
      toPersonDetails: actual.TmdbMapper.toPersonDetails,
    },
  };
});

// Mock ResilientHttpClient to disable retries in tests
jest.mock('@/common/http/resilient-http.client', () => {
  const original = jest.requireActual('@/common/http/resilient-http.client');
  return {
    ...original,
    ResilientHttpClient: class MockResilientHttpClient {
      async fetch<T>(
        url: string,
        options?: RequestInit,
      ): Promise<{
        data: T | null;
        success: boolean;
        attempts: number;
        error?: Error;
        isRetryable?: boolean;
      }> {
        try {
          const response = await fetch(url, options);
          if (!response.ok) {
            const error = new original.HttpError(
              `${response.status} ${response.statusText}`,
              response.status,
              response.headers,
            );
            return {
              data: null,
              success: false,
              attempts: 1,
              error,
              isRetryable: original.isRetryableError(error),
            };
          }
          const data = await response.json();
          return { data, success: true, attempts: 1 };
        } catch (error: any) {
          return {
            data: null,
            success: false,
            attempts: 1,
            error,
            isRetryable: true,
          };
        }
      }
      async get<T>(url: string, headers?: HeadersInit) {
        return this.fetch<T>(url, { method: 'GET', headers });
      }
    },
    HttpError: original.HttpError,
    isRetryableError: original.isRetryableError,
  };
});

describe('TmdbAdapter', () => {
  let adapter: TmdbAdapter;

  const mockConfig = {
    apiKey: 'test-api-key',
    apiUrl: 'https://api.themoviedb.org/3',
  };

  beforeEach(async () => {
    mockFetch.mockReset();
    mockToDomain.mockReset();
    // Default mock implementation
    mockToDomain.mockImplementation((data, type) => ({
      type,
      title: data.title || data.name,
      externalIds: { tmdbId: data.id },
      popularity: data.popularity,
      credits: { cast: [], crew: [] },
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [TmdbAdapter, { provide: tmdbConfig.KEY, useValue: mockConfig }],
    }).compile();

    adapter = module.get<TmdbAdapter>(TmdbAdapter);
  });

  describe('getMovie', () => {
    it('should fetch movie with correct URL and params', async () => {
      const mockMovieData = {
        id: 550,
        title: 'Fight Club',
        popularity: 100,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMovieData),
      });

      const result = await adapter.getMovie(550);

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Fight Club');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/movie/550'),
        expect.anything(),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api_key=test-api-key'),
        expect.anything(),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('language=uk-UA'),
        expect.anything(),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('include_video_language=uk%2Cen'),
        expect.anything(),
      );
    });

    it('should return null when movie not found (404)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await adapter.getMovie(999999);

      expect(result).toBeNull();
    });

    it('should throw on other errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(adapter.getMovie(550)).rejects.toThrow(TmdbApiException);
    });

    it('should include append_to_response params', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 550, title: 'Test' }),
      });

      await adapter.getMovie(550);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('append_to_response='),
        expect.anything(),
      );
    });

    it('should return fallback object when mapper returns null (no localization)', async () => {
      const mockMovieData = {
        id: 12345,
        title: 'Nosferatu',
        original_title: 'Nosferatu',
        imdb_id: 'tt1234567',
        poster_path: '/poster.jpg',
        backdrop_path: '/backdrop.jpg',
        vote_average: 7.5,
        vote_count: 1000,
        popularity: 50,
        release_date: '2024-12-25',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMovieData),
      });

      // Mapper returns null (no Ukrainian localization)
      mockToDomain.mockReturnValue(null);

      const result = await adapter.getMovie(12345);

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Nosferatu');
      expect(result?.externalIds.tmdbId).toBe(12345);
      expect(result?.type).toBe(MediaType.MOVIE);
      expect(result?.posterPath).toBe('/poster.jpg');
    });

    it('should preserve originCountries and originalLanguage in fallback path', async () => {
      const mockMovieData = {
        id: 12345,
        title: 'Nosferatu',
        original_title: 'Nosferatu',
        original_language: 'de',
        production_countries: [{ iso_3166_1: 'DE' }, { iso_3166_1: 'US' }],
        poster_path: '/poster.jpg',
        vote_average: 7.5,
        vote_count: 1000,
        popularity: 50,
        release_date: '2024-12-25',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockMovieData),
      });

      // Mapper returns null - fallback should still preserve origin metadata
      mockToDomain.mockReturnValue(null);

      const result = await adapter.getMovie(12345);

      expect(result).not.toBeNull();
      expect(result?.originCountries).toEqual(['DE', 'US']);
      expect(result?.originalLanguage).toBe('de');
    });

    it('should return null when TMDB returns no data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(null),
      });

      mockToDomain.mockReturnValue(null);

      const result = await adapter.getMovie(99999);

      expect(result).toBeNull();
    });
  });

  describe('getShow', () => {
    it('should fetch show with correct URL', async () => {
      const mockShowData = {
        id: 1000,
        name: 'Breaking Bad',
        popularity: 200,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockShowData),
      });

      const result = await adapter.getShow(1000);

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Breaking Bad');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tv/1000'),
        expect.anything(),
      );
    });

    it('should return null when show not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await adapter.getShow(999999);

      expect(result).toBeNull();
    });

    it('should throw on other errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(adapter.getShow(1000)).rejects.toThrow(TmdbApiException);
    });

    it('should return fallback object when mapper returns null (no localization)', async () => {
      const mockShowData = {
        id: 54321,
        name: 'Some Show',
        original_name: 'Original Show Name',
        poster_path: '/show-poster.jpg',
        backdrop_path: '/show-backdrop.jpg',
        vote_average: 8.0,
        vote_count: 500,
        popularity: 75,
        first_air_date: '2024-01-01',
        external_ids: { imdb_id: 'tt9999999' },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockShowData),
      });

      mockToDomain.mockReturnValue(null);

      const result = await adapter.getShow(54321);

      expect(result).not.toBeNull();
      expect(result?.title).toBe('Some Show');
      expect(result?.externalIds.tmdbId).toBe(54321);
      expect(result?.type).toBe(MediaType.SHOW);
      expect(result?.releaseDate).toEqual(new Date('2024-01-01'));
    });

    it('should preserve originCountries and originalLanguage in fallback path', async () => {
      const mockShowData = {
        id: 54321,
        name: 'Korean Drama',
        original_name: '한국 드라마',
        original_language: 'ko',
        origin_country: ['KR'],
        poster_path: '/show-poster.jpg',
        vote_average: 8.5,
        vote_count: 500,
        popularity: 75,
        first_air_date: '2024-01-01',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockShowData),
      });

      // Mapper returns null - fallback should still preserve origin metadata
      mockToDomain.mockReturnValue(null);

      const result = await adapter.getShow(54321);

      expect(result).not.toBeNull();
      expect(result?.originCountries).toEqual(['KR']);
      expect(result?.originalLanguage).toBe('ko');
    });
  });

  describe('getTrending', () => {
    it('should fetch trending and filter by media type', async () => {
      const mockTrendingData = {
        results: [
          { id: 1, media_type: 'movie' },
          { id: 2, media_type: 'tv' },
          { id: 3, media_type: 'person' }, // Should be filtered out
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTrendingData),
      });

      const result = await adapter.getTrending(1);

      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { tmdbId: 1, type: MediaType.MOVIE },
        { tmdbId: 2, type: MediaType.SHOW },
      ]);
    });

    it('should use movie endpoint when type is MOVIE', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await adapter.getTrending(1, MediaType.MOVIE);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/trending/movie/day'),
        expect.anything(),
      );
    });

    it('should use tv endpoint when type is SHOW', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await adapter.getTrending(1, MediaType.SHOW);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/trending/tv/day'),
        expect.anything(),
      );
    });

    it('should use correct endpoint', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await adapter.getTrending(2);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/trending/all/day'),
        expect.anything(),
      );
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('page=2'), expect.anything());
    });

    it('should use default page 1', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await adapter.getTrending();

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('page=1'), expect.anything());
    });

    it('should handle empty results', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      const result = await adapter.getTrending();

      expect(result).toEqual([]);
    });

    it('should handle missing results field', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const result = await adapter.getTrending();

      expect(result).toEqual([]);
    });
  });

  describe('getNowPlayingIds', () => {
    it('should fetch all pages until total_pages and return aggregated IDs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            page: 1,
            total_pages: 2,
            results: [{ id: 101 }, { id: 102 }],
          }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            page: 2,
            total_pages: 2,
            results: [{ id: 103 }, { id: 104 }],
          }),
      });

      const result = await adapter.getNowPlayingIds();

      expect(result).toHaveLength(4);
      expect(result).toEqual([101, 102, 103, 104]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('page=1'), expect.anything());
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('page=2'), expect.anything());
    });

    it('should stop early if total_pages < limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            page: 1,
            total_pages: 1,
            results: [{ id: 101 }],
          }),
      });

      const result = await adapter.getNowPlayingIds();

      expect(result).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getNewReleaseIds', () => {
    it('should fetch all pages until total_pages and return aggregated IDs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            page: 1,
            total_pages: 2,
            results: [{ id: 201 }],
          }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            page: 2,
            total_pages: 2,
            results: [{ id: 202 }],
          }),
      });

      const result = await adapter.getNewReleaseIds(30, 'UA');

      expect(result).toEqual([201, 202]);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/discover/movie'),
        expect.anything(),
      );
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('page=1'), expect.anything());
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('page=2'), expect.anything());
    });
  });

  describe('searchMulti', () => {
    it('should search for movies and shows', async () => {
      const mockResults = {
        results: [
          { id: 1, media_type: 'movie', title: 'Movie 1' },
          { id: 2, media_type: 'tv', name: 'Show 1' },
          { id: 3, media_type: 'person', name: 'Person 1' }, // Should be filtered
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResults),
      });

      const result = await adapter.searchMulti('test');

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe(MediaType.MOVIE);
      expect(result[1].type).toBe(MediaType.SHOW);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/search/multi'),
        expect.anything(),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('query=test'),
        expect.anything(),
      );
    });

    it('should search with Ukrainian language for localized titles', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });

      await adapter.searchMulti('Ходячі мерці');

      // Should include language=uk-UA to get Ukrainian titles in results
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('language=uk-UA'),
        expect.anything(),
      );
    });

    it('should map all required fields from search results', async () => {
      const mockResults = {
        results: [
          {
            id: 123,
            media_type: 'movie',
            title: 'Test Movie',
            original_title: 'Original Title',
            release_date: '2024-01-15',
            poster_path: '/poster.jpg',
            vote_average: 8.5,
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResults),
      });

      const result = await adapter.searchMulti('test');

      expect(result[0]).toEqual({
        externalIds: { tmdbId: 123 },
        type: MediaType.MOVIE,
        title: 'Test Movie',
        originalTitle: 'Original Title',
        releaseDate: '2024-01-15',
        posterPath: '/poster.jpg',
        rating: 8.5,
      });
    });
  });

  describe('getSeasonEpisodes', () => {
    it('should fetch and map episodes for a season', async () => {
      const mockSeasonData = {
        id: 100,
        season_number: 1,
        episodes: [
          {
            id: 1001,
            episode_number: 1,
            name: 'Серія 1',
            overview: 'First episode',
            air_date: '2026-01-15',
            runtime: 50,
            still_path: '/still1.jpg',
            vote_average: 7.5,
          },
          {
            id: 1002,
            episode_number: 2,
            name: 'Серія 2',
            overview: null,
            air_date: '2026-01-15',
            runtime: 57,
            still_path: null,
            vote_average: 0,
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSeasonData),
      });

      const result = await adapter.getSeasonEpisodes(310537, 1);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        tmdbId: 1001,
        number: 1,
        title: 'Серія 1',
        overview: 'First episode',
        airDate: new Date('2026-01-15'),
        runtime: 50,
        stillPath: '/still1.jpg',
        rating: 7.5,
      });
      expect(result[1]).toEqual({
        tmdbId: 1002,
        number: 2,
        title: 'Серія 2',
        overview: null,
        airDate: new Date('2026-01-15'),
        runtime: 57,
        stillPath: null,
        rating: null,
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tv/310537/season/1'),
        expect.anything(),
      );
    });

    it('should return empty array on 404', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await adapter.getSeasonEpisodes(999999, 1);

      expect(result).toEqual([]);
    });

    it('should return empty array on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const result = await adapter.getSeasonEpisodes(310537, 1);

      expect(result).toEqual([]);
    });

    it('should return empty array when episodes array is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 100, season_number: 1 }),
      });

      const result = await adapter.getSeasonEpisodes(310537, 1);

      expect(result).toEqual([]);
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(adapter.getMovie(550)).rejects.toThrow('Failed to communicate with TMDB');
    });
  });

  describe('getPerson', () => {
    it('fetches and maps person details', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 287,
            name: 'Brad Pitt',
            biography: 'An American actor.',
            birthday: '1963-12-18',
            deathday: null,
            place_of_birth: 'Shawnee, Oklahoma, USA',
            profile_path: '/b.jpg',
            known_for_department: 'Acting',
            popularity: 42,
          }),
      });

      const result = await adapter.getPerson(287);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/person/287'),
        expect.anything(),
      );
      expect(result).toMatchObject({
        tmdbId: 287,
        name: 'Brad Pitt',
        biography: 'An American actor.',
        knownForDepartment: 'Acting',
        popularity: 42,
      });
      expect(result?.birthday).toEqual(new Date('1963-12-18'));
    });

    it('returns null when the person is not found (404)', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });

      expect(await adapter.getPerson(999999)).toBeNull();
    });

    it('throws on non-404 errors', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });

      await expect(adapter.getPerson(287)).rejects.toThrow(TmdbApiException);
    });
  });
});
