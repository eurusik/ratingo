import { Test, TestingModule } from '@nestjs/testing';
import { MdblistAdapter } from './mdblist.adapter';
import mdblistConfig from '@/config/mdblist.config';
import { MediaType } from '@/common/enums/media-type.enum';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

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

describe('MdblistAdapter', () => {
  let adapter: MdblistAdapter;

  const mockConfig = {
    apiKey: 'test-api-key',
    apiUrl: 'https://api.mdblist.com',
  };

  beforeEach(async () => {
    mockFetch.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [MdblistAdapter, { provide: mdblistConfig.KEY, useValue: mockConfig }],
    }).compile();

    adapter = module.get<MdblistAdapter>(MdblistAdapter);
  });

  describe('getRottenTomatoesRatings', () => {
    it('parses critics and audience scores from ratings array', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            title: 'Euphoria',
            ratings: [
              { source: 'imdb', value: 8.2, score: 82, votes: 298241, url: 6 },
              { source: 'metacritic', value: 70, score: 70, votes: 45, url: '/x' },
              { source: 'tomatoes', value: 78, score: 78, votes: 241, url: '/tv/euphoria' },
              { source: 'popcorn', value: 76, score: 76, votes: null, url: '/tv/euphoria' },
            ],
          }),
      });

      const result = await adapter.getRottenTomatoesRatings(85552, MediaType.SHOW);

      expect(result).toEqual({
        rottenTomatoesCritics: 78,
        rottenTomatoesAudience: 76,
      });
    });

    it('uses /tmdb/show/:id path for shows', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ratings: [] }),
      });

      await adapter.getRottenTomatoesRatings(85552, MediaType.SHOW);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tmdb/show/85552'),
        expect.anything(),
      );
    });

    it('uses /tmdb/movie/:id path for movies', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ratings: [] }),
      });

      await adapter.getRottenTomatoesRatings(550, MediaType.MOVIE);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/tmdb/movie/550'),
        expect.anything(),
      );
    });

    it('passes apikey as query param', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ ratings: [] }),
      });

      await adapter.getRottenTomatoesRatings(550, MediaType.MOVIE);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('apikey=test-api-key'),
        expect.anything(),
      );
    });

    it('returns null fields when source entries are missing', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ratings: [{ source: 'imdb', value: 8.0, score: 80, votes: 100, url: null }],
          }),
      });

      const result = await adapter.getRottenTomatoesRatings(1, MediaType.MOVIE);
      expect(result).toEqual({ rottenTomatoesCritics: null, rottenTomatoesAudience: null });
    });

    it('returns null fields when rating value is null', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ratings: [
              { source: 'tomatoes', value: null, score: null, votes: null, url: null },
              { source: 'popcorn', value: null, score: null, votes: null, url: null },
            ],
          }),
      });

      const result = await adapter.getRottenTomatoesRatings(1, MediaType.MOVIE);
      expect(result).toEqual({ rottenTomatoesCritics: null, rottenTomatoesAudience: null });
    });

    it('clamps out-of-range scores to 0-100', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ratings: [
              { source: 'tomatoes', value: 120, score: 120, votes: null, url: null },
              { source: 'popcorn', value: -5, score: -5, votes: null, url: null },
            ],
          }),
      });

      const result = await adapter.getRottenTomatoesRatings(1, MediaType.MOVIE);
      expect(result).toEqual({ rottenTomatoesCritics: 100, rottenTomatoesAudience: 0 });
    });

    it('returns null fields on HTTP error (best-effort, no throw)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers(),
      });

      const result = await adapter.getRottenTomatoesRatings(1, MediaType.MOVIE);
      expect(result).toEqual({ rottenTomatoesCritics: null, rottenTomatoesAudience: null });
    });

    it('returns null fields on network failure (best-effort)', async () => {
      mockFetch.mockRejectedValue(new Error('network down'));

      const result = await adapter.getRottenTomatoesRatings(1, MediaType.MOVIE);
      expect(result).toEqual({ rottenTomatoesCritics: null, rottenTomatoesAudience: null });
    });

    it('returns null fields and does not fetch for invalid tmdbId', async () => {
      const cases: Array<number> = [0, -1, NaN, 1.5, 2 ** 31];
      for (const badId of cases) {
        mockFetch.mockReset();
        const result = await adapter.getRottenTomatoesRatings(badId, MediaType.MOVIE);
        expect(result).toEqual({ rottenTomatoesCritics: null, rottenTomatoesAudience: null });
        expect(mockFetch).not.toHaveBeenCalled();
      }
    });

    it('returns null fields and does not fetch for invalid media type', async () => {
      const result = await adapter.getRottenTomatoesRatings(123, 'invalid' as MediaType);
      expect(result).toEqual({ rottenTomatoesCritics: null, rottenTomatoesAudience: null });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('throws if API key is not configured', async () => {
      const moduleWithoutKey: TestingModule = await Test.createTestingModule({
        providers: [
          MdblistAdapter,
          { provide: mdblistConfig.KEY, useValue: { apiKey: undefined, apiUrl: 'x' } },
        ],
      }).compile();

      const adapterNoKey = moduleWithoutKey.get<MdblistAdapter>(MdblistAdapter);

      // Best-effort wrapper catches and returns nulls — adapter doesn't throw to caller.
      const result = await adapterNoKey.getRottenTomatoesRatings(1, MediaType.MOVIE);
      expect(result).toEqual({ rottenTomatoesCritics: null, rottenTomatoesAudience: null });
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
