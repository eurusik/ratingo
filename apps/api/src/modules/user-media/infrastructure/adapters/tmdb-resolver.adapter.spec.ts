import { HttpStatus } from '@nestjs/common';

import { TmdbApiException } from '../../../../common/exceptions/external-api.exception';
import { ResilientHttpClient } from '../../../../common/http/resilient-http.client';

import { TmdbResolverAdapter } from './tmdb-resolver.adapter';

// We mock the entire ResilientHttpClient module so we can control httpClient.get()
// without making real HTTP requests.
const mockGet = jest.fn();

jest.mock('../../../../common/http/resilient-http.client', () => {
  return {
    ResilientHttpClient: jest.fn().mockImplementation(() => ({
      get: mockGet,
    })),
    // Re-export HttpError as a real class so instanceof checks work
    HttpError: class HttpError extends Error {
      status: number;
      constructor(message: string, status: number) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
      }
    },
  };
});

const fakeConfig = {
  apiUrl: 'https://api.themoviedb.org/3',
  apiKey: 'test-api-key',
};

describe('TmdbResolverAdapter', () => {
  let adapter: TmdbResolverAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new TmdbResolverAdapter(fakeConfig as any);
  });

  describe('findByImdbId', () => {
    it('returns {tmdbId, type: movie} when movie results exist', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: {
          movie_results: [{ id: 550 }],
          tv_results: [],
        },
      });

      const result = await adapter.findByImdbId('tt0000001');

      expect(result).toEqual({ tmdbId: 550, type: 'movie' });
    });

    it('returns {tmdbId, type: show} when only tv results exist', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: {
          movie_results: [],
          tv_results: [{ id: 1399 }],
        },
      });

      const result = await adapter.findByImdbId('tt1234567');

      expect(result).toEqual({ tmdbId: 1399, type: 'show' });
    });

    it('movie takes precedence over tv when both results are present', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: {
          movie_results: [{ id: 550 }],
          tv_results: [{ id: 1399 }],
        },
      });

      const result = await adapter.findByImdbId('tt0000001');

      expect(result).toEqual({ tmdbId: 550, type: 'movie' });
    });

    it('returns null when both movie and tv results are empty', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: {
          movie_results: [],
          tv_results: [],
        },
      });

      const result = await adapter.findByImdbId('tt9999999');

      expect(result).toBeNull();
    });

    it('returns null on TMDB 404 — catches TmdbApiException with NOT_FOUND statusCode', async () => {
      // The adapter's fetch() throws TmdbApiException for NOT_FOUND.
      // findByImdbId catches that specific exception and returns null.
      mockGet.mockImplementation(() => {
        throw new TmdbApiException('Resource not found', HttpStatus.NOT_FOUND);
      });

      const result = await adapter.findByImdbId('tt0000000');

      expect(result).toBeNull();
    });

    it('rethrows non-404 TmdbApiException from TMDB API', async () => {
      mockGet.mockImplementation(() => {
        throw new TmdbApiException('Service unavailable', HttpStatus.SERVICE_UNAVAILABLE);
      });

      await expect(adapter.findByImdbId('tt0000001')).rejects.toThrow(TmdbApiException);
    });

    it('calls the correct TMDB Find endpoint with imdb_id external_source and api_key', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { movie_results: [{ id: 550 }], tv_results: [] },
      });

      await adapter.findByImdbId('tt0000001');

      const [urlArg] = mockGet.mock.calls[0];
      expect(urlArg).toContain('/find/tt0000001');
      expect(urlArg).toContain('external_source=imdb_id');
      expect(urlArg).toContain('api_key=test-api-key');
    });

    it('throws TmdbApiException with SERVICE_UNAVAILABLE on retryable failure from client', async () => {
      // httpClient.get() returns a failed retryable result (network error after retries)
      mockGet.mockResolvedValue({
        success: false,
        data: null,
        error: new Error('Timeout'),
        isRetryable: true,
      });

      await expect(adapter.findByImdbId('tt0000001')).rejects.toThrow(TmdbApiException);
    });

    it('throws TmdbApiException on non-retryable non-404 HTTP error from client', async () => {
      // httpClient.get() returns a non-success, non-retryable result for a non-404 error
      const { HttpError } = jest.requireMock('../../../../common/http/resilient-http.client');
      const httpError = new HttpError('403 Forbidden', 403);

      mockGet.mockResolvedValue({
        success: false,
        data: null,
        error: httpError,
        isRetryable: false,
      });

      await expect(adapter.findByImdbId('tt0000001')).rejects.toThrow(TmdbApiException);
    });

    it('returns null when client returns non-success with 404 HttpError', async () => {
      // The adapter's fetch() converts a 404 HttpError into TmdbApiException(NOT_FOUND),
      // then findByImdbId catches TmdbApiException with NOT_FOUND statusCode and returns null.
      const { HttpError } = jest.requireMock('../../../../common/http/resilient-http.client');
      const httpError = new HttpError('404 Not Found', HttpStatus.NOT_FOUND);

      mockGet.mockResolvedValue({
        success: false,
        data: null,
        error: httpError,
        isRetryable: false,
      });

      const result = await adapter.findByImdbId('tt0000001');

      expect(result).toBeNull();
    });
  });

  describe('checkExists', () => {
    it('returns true for a movie that exists (HTTP 200)', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { id: 550 },
      });

      const result = await adapter.checkExists(550, 'movie');

      expect(result).toBe(true);
    });

    it('returns true for a show that exists (HTTP 200)', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { id: 1399 },
      });

      const result = await adapter.checkExists(1399, 'show');

      expect(result).toBe(true);
    });

    it('returns false for a movie that does not exist (TMDB 404)', async () => {
      mockGet.mockImplementation(() => {
        throw new TmdbApiException('Resource not found', HttpStatus.NOT_FOUND);
      });

      const result = await adapter.checkExists(99999, 'movie');

      expect(result).toBe(false);
    });

    it('returns false for a show that does not exist (TMDB 404)', async () => {
      mockGet.mockImplementation(() => {
        throw new TmdbApiException('Resource not found', HttpStatus.NOT_FOUND);
      });

      const result = await adapter.checkExists(99999, 'show');

      expect(result).toBe(false);
    });

    it('rethrows non-404 TmdbApiException', async () => {
      mockGet.mockImplementation(() => {
        throw new TmdbApiException('Internal server error', HttpStatus.INTERNAL_SERVER_ERROR);
      });

      await expect(adapter.checkExists(550, 'movie')).rejects.toThrow(TmdbApiException);
    });

    it('calls /movie/{id} endpoint for movie type', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { id: 550 },
      });

      await adapter.checkExists(550, 'movie');

      const [urlArg] = mockGet.mock.calls[0];
      expect(urlArg).toContain('/movie/550');
    });

    it('calls /tv/{id} endpoint for show type', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { id: 1399 },
      });

      await adapter.checkExists(1399, 'show');

      const [urlArg] = mockGet.mock.calls[0];
      expect(urlArg).toContain('/tv/1399');
    });

    it('rethrows unexpected errors that are not TmdbApiException', async () => {
      const networkError = new Error('Network failure');
      mockGet.mockImplementation(() => {
        throw networkError;
      });

      await expect(adapter.checkExists(550, 'movie')).rejects.toThrow('Network failure');
    });

    it('includes api_key in the checkExists URL', async () => {
      mockGet.mockResolvedValue({
        success: true,
        data: { id: 550 },
      });

      await adapter.checkExists(550, 'movie');

      const [urlArg] = mockGet.mock.calls[0];
      expect(urlArg).toContain('api_key=test-api-key');
    });
  });
});
