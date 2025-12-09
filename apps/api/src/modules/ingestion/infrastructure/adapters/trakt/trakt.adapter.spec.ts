import { Test, TestingModule } from '@nestjs/testing';
import { TraktAdapter } from './trakt.adapter';
import traktConfig from '@/config/trakt.config';
import { TraktApiException } from '@/common/exceptions';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('TraktAdapter', () => {
  let adapter: TraktAdapter;

  const mockConfig = {
    clientId: 'test-client-id',
    apiUrl: 'https://api.trakt.tv',
    userAgent: 'Ratingo/1.0',
  };

  beforeEach(async () => {
    mockFetch.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TraktAdapter,
        { provide: traktConfig.KEY, useValue: mockConfig },
      ],
    }).compile();

    adapter = module.get<TraktAdapter>(TraktAdapter);
  });

  describe('constructor', () => {
    it('should throw if clientId is not configured', async () => {
      await expect(
        Test.createTestingModule({
          providers: [
            TraktAdapter,
            { provide: traktConfig.KEY, useValue: { ...mockConfig, clientId: '' } },
          ],
        }).compile()
      ).rejects.toThrow(TraktApiException);
    });
  });

  describe('getTrendingMovies', () => {
    it('should fetch trending movies with correct headers', async () => {
      const mockResponse = [
        { movie: { ids: { tmdb: 550 } }, watchers: 100 },
        { movie: { ids: { tmdb: 551 } }, watchers: 80 },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await adapter.getTrendingMovies(10);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.trakt.tv/movies/trending?limit=10',
        expect.objectContaining({
          headers: expect.objectContaining({
            'trakt-api-key': 'test-client-id',
            'trakt-api-version': '2',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should use default limit of 20', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await adapter.getTrendingMovies();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=20'),
        expect.any(Object)
      );
    });
  });

  describe('getTrendingShows', () => {
    it('should fetch trending shows', async () => {
      const mockResponse = [
        { show: { ids: { tmdb: 1000 } }, watchers: 200 },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await adapter.getTrendingShows(5);

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.trakt.tv/shows/trending?limit=5',
        expect.any(Object)
      );
    });
  });

  describe('getMovieRatingsByTmdbId', () => {
    it('should lookup movie and return ratings', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/search/tmdb/100')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ movie: { ids: { trakt: 123 } } }])
          });
        }
        if (url.includes('/movies/123/ratings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ rating: 8.5, votes: 10000 })
          });
        }
        if (url.includes('/movies/123/watching')) {
          return Promise.reject(new Error('Network error')); // Watchers fail
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const result = await adapter.getMovieRatingsByTmdbId(100);

      // Should still return ratings, with watchers 0
      expect(result).toEqual({ rating: 8.5, votes: 10000, watchers: 0 });
    });

    it('should return null when movie not found', async () => {
      mockFetch.mockResolvedValueOnce([]); // Lookup returns empty

      const result = await adapter.getMovieRatingsByTmdbId(999);

      expect(result).toBeNull();
    });
  });

  describe('getShowRatingsByTmdbId', () => {
    it('should lookup show and return ratings', async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/search/tmdb/1000')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([{ show: { ids: { trakt: 200 } } }])
          });
        }
        if (url.includes('/shows/200/ratings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ rating: 9.0, votes: 50000 })
          });
        }
        if (url.includes('/shows/200/watching')) {
          return Promise.reject(new Error('Network error')); // Watchers fail
        }
        return Promise.reject(new Error(`Unexpected URL: ${url}`));
      });

      const result = await adapter.getShowRatingsByTmdbId(1000);

      // Should still return ratings, with watchers 0
      expect(result).toEqual({ rating: 9.0, votes: 50000, watchers: 0 });
    });
  });

  describe('getTrendingMoviesWithWatchers', () => {
    it('should return formatted trending data with watchers', async () => {
      const mockResponse = [
        { movie: { ids: { tmdb: 550 } }, watchers: 1000 },
        { movie: { ids: { tmdb: 551 } }, watchers: 800 },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await adapter.getTrendingMoviesWithWatchers(10);

      expect(result).toEqual([
        { tmdbId: 550, watchers: 1000, rank: 1 },
        { tmdbId: 551, watchers: 800, rank: 2 },
      ]);
    });

    it('should filter out items without tmdbId', async () => {
      const mockResponse = [
        { movie: { ids: { tmdb: 550 } }, watchers: 1000 },
        { movie: { ids: {} }, watchers: 500 }, // No TMDB ID
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await adapter.getTrendingMoviesWithWatchers();

      expect(result).toHaveLength(1);
      expect(result[0].tmdbId).toBe(550);
    });
  });

  describe('rate limiting', () => {
    it('should retry after rate limit (429)', async () => {
      // First call returns 429
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Map([['Retry-After', '0.1']]), // 100ms
        })
        // Second call succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([]),
        });

      // Mock headers.get
      mockFetch.mockImplementationOnce(() =>
        Promise.resolve({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: { get: () => '0.1' },
        })
      ).mockImplementationOnce(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve([{ movie: { ids: { tmdb: 1 } } }]),
        })
      );

      const result = await adapter.getTrendingMovies(1);

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should throw TraktApiException on non-OK response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: { get: () => null },
      });

      await expect(adapter.getTrendingMovies()).rejects.toThrow(TraktApiException);
    });

    it('should handle network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(adapter.getTrendingMovies()).rejects.toThrow('Network error');
    });
  });

  describe('getShowEpisodesForAnalysis', () => {
    it('should fetch all seasons and episodes', async () => {
      // Search by TMDB ID
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ show: { ids: { trakt: 100 } } }]),
        })
        // Get seasons
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            { number: 0, episode_count: 5 }, // Specials - should be filtered
            { number: 1, episode_count: 10 },
            { number: 2, episode_count: 8 },
          ]),
        })
        // Get S1 episodes
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            { number: 1, title: 'Pilot', rating: 8.5, votes: 1000 },
            { number: 2, title: 'Episode 2', rating: 8.0, votes: 900 },
          ]),
        })
        // Get S2 episodes
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([
            { number: 1, title: 'S2E1', rating: 7.5, votes: 800 },
          ]),
        });

      const result = await adapter.getShowEpisodesForAnalysis(12345);

      expect(result).not.toBeNull();
      expect(result?.traktId).toBe(100);
      expect(result?.seasons).toHaveLength(2); // Specials filtered out
      expect(result?.seasons[0].episodes).toHaveLength(2);
    });

    it('should return null when show not found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      const result = await adapter.getShowEpisodesForAnalysis(999999);

      expect(result).toBeNull();
    });
  });
});
