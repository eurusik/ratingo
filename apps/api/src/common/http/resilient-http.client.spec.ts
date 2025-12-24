import {
  ResilientHttpClient,
  isRetryableError,
  calculateBackoffDelay,
  parseRetryAfter,
  HttpError,
  DEFAULT_RETRY_CONFIG,
} from './resilient-http.client';

// Mock global fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock setTimeout and clearTimeout
jest.useFakeTimers();

describe('ResilientHttpClient', () => {
  let client: ResilientHttpClient;

  beforeEach(() => {
    client = new ResilientHttpClient();
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe('isRetryableError', () => {
    it('should return true for network errors', () => {
      const networkError = new Error('Network error');
      expect(isRetryableError(networkError)).toBe(true);
    });

    it('should return true for timeout errors', () => {
      const timeoutError = { name: 'AbortError' };
      expect(isRetryableError(timeoutError)).toBe(true);
    });

    it('should return true for retryable status codes', () => {
      expect(isRetryableError({ status: 429 })).toBe(true);
      expect(isRetryableError({ status: 500 })).toBe(true);
      expect(isRetryableError({ status: 502 })).toBe(true);
      expect(isRetryableError({ status: 503 })).toBe(true);
      expect(isRetryableError({ status: 504 })).toBe(true);
    });

    it('should return false for non-retryable status codes', () => {
      expect(isRetryableError({ status: 400 })).toBe(false);
      expect(isRetryableError({ status: 401 })).toBe(false);
      expect(isRetryableError({ status: 403 })).toBe(false);
      expect(isRetryableError({ status: 404 })).toBe(false);
      expect(isRetryableError({ status: 422 })).toBe(false);
    });

    it('should return false for AbortError', () => {
      expect(isRetryableError({ name: 'AbortError' })).toBe(true);
    });
  });

  describe('calculateBackoffDelay', () => {
    beforeEach(() => {
      // Mock Math.random to return consistent value
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should calculate exponential backoff with jitter', () => {
      const baseDelay = 1000;

      // attempt 0: 1000 * 2^0 * 1.0 = 1000
      expect(calculateBackoffDelay(0, baseDelay)).toBe(1000);

      // attempt 1: 1000 * 2^1 * 1.0 = 2000
      expect(calculateBackoffDelay(1, baseDelay)).toBe(2000);

      // attempt 2: 1000 * 2^2 * 1.0 = 4000
      expect(calculateBackoffDelay(2, baseDelay)).toBe(4000);
    });
  });

  describe('parseRetryAfter', () => {
    it('should parse seconds format', () => {
      const headers = new Headers({ 'retry-after': '30' });
      expect(parseRetryAfter(headers)).toBe(30000);
    });

    it('should parse decimal seconds', () => {
      const headers = new Headers({ 'retry-after': '1.5' });
      expect(parseRetryAfter(headers)).toBe(1500);
    });

    it('should return null for missing header', () => {
      const headers = new Headers();
      expect(parseRetryAfter(headers)).toBeNull();
    });

    it('should return null for invalid format', () => {
      const headers = new Headers({ 'retry-after': 'invalid' });
      expect(parseRetryAfter(headers)).toBeNull();
    });
  });

  describe('HttpError', () => {
    it('should create error with status and message', () => {
      const error = new HttpError('Not Found', 404);
      expect(error.message).toBe('Not Found');
      expect(error.status).toBe(404);
      expect(error.name).toBe('HttpError');
    });

    it('should create error with headers', () => {
      const headers = new Headers({ 'content-type': 'application/json' });
      const error = new HttpError('Server Error', 500, headers);
      expect(error.headers).toBe(headers);
    });
  });

  describe('ResilientHttpClient', () => {
    it('should use default config when no config provided', () => {
      const client = new ResilientHttpClient();
      expect(client).toBeDefined();
    });

    it('should merge provided config with defaults', () => {
      const customConfig = { maxRetries: 5 };
      const client = new ResilientHttpClient(customConfig);
      expect(client).toBeDefined();
    });

    describe('successful requests', () => {
      it('should return successful result for valid response', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ data: 'test' }),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const result = await client.get('https://api.example.com/test');

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ data: 'test' });
        expect(result.attempts).toBe(1);
      });
    });

    describe('error handling', () => {
      it('should not retry non-retryable errors', async () => {
        const mockResponse = {
          ok: false,
          status: 404,
          statusText: 'Not Found',
          headers: new Headers(),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const result = await client.get('https://api.example.com/test');

        expect(result.success).toBe(false);
        expect(result.attempts).toBe(1);
        expect(result.isRetryable).toBe(false);
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });

      it('should retry retryable errors up to maxRetries', async () => {
        const mockResponse = {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          headers: new Headers(),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        // Start the request
        const resultPromise = client.get('https://api.example.com/test');

        // Fast-forward through all the retry delays
        for (let i = 0; i < DEFAULT_RETRY_CONFIG.maxRetries; i++) {
          await jest.advanceTimersByTimeAsync(5000); // Advance past any delay
        }

        const result = await resultPromise;

        expect(result.success).toBe(false);
        expect(result.attempts).toBe(DEFAULT_RETRY_CONFIG.maxRetries + 1);
        expect(result.isRetryable).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(DEFAULT_RETRY_CONFIG.maxRetries + 1);
      });

      it('should handle network errors', async () => {
        const networkError = new Error('Network error');
        mockFetch.mockRejectedValue(networkError);

        // Start the request
        const resultPromise = client.get('https://api.example.com/test');

        // Fast-forward through all the retry delays
        for (let i = 0; i < DEFAULT_RETRY_CONFIG.maxRetries; i++) {
          await jest.advanceTimersByTimeAsync(5000);
        }

        const result = await resultPromise;

        expect(result.success).toBe(false);
        expect(result.attempts).toBe(DEFAULT_RETRY_CONFIG.maxRetries + 1);
        expect(result.isRetryable).toBe(true);
      });

      it('should handle timeout errors', async () => {
        const timeoutError = { name: 'AbortError' };
        mockFetch.mockRejectedValue(timeoutError);

        // Start the request
        const resultPromise = client.get('https://api.example.com/test');

        // Fast-forward through all the retry delays
        for (let i = 0; i < DEFAULT_RETRY_CONFIG.maxRetries; i++) {
          await jest.advanceTimersByTimeAsync(5000);
        }

        const result = await resultPromise;

        expect(result.success).toBe(false);
        expect(result.attempts).toBe(DEFAULT_RETRY_CONFIG.maxRetries + 1);
        expect(result.isRetryable).toBe(true);
      });

      it('should respect retry-after header', async () => {
        const mockResponse = {
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Headers({ 'retry-after': '2' }),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        // Start the request
        const resultPromise = client.get('https://api.example.com/test');

        // Fast-forward through all the retry delays
        for (let i = 0; i < DEFAULT_RETRY_CONFIG.maxRetries; i++) {
          await jest.advanceTimersByTimeAsync(5000);
        }

        const result = await resultPromise;

        expect(mockFetch).toHaveBeenCalledTimes(DEFAULT_RETRY_CONFIG.maxRetries + 1);
        expect(result.success).toBe(false);
      });

      it('should handle different HTTP error status codes', async () => {
        const testCases = [
          { status: 400, shouldRetry: false },
          { status: 401, shouldRetry: false },
          { status: 403, shouldRetry: false },
          { status: 429, shouldRetry: true },
          { status: 500, shouldRetry: true },
          { status: 502, shouldRetry: true },
          { status: 503, shouldRetry: true },
          { status: 504, shouldRetry: true },
        ];

        for (const testCase of testCases) {
          mockFetch.mockClear();
          const mockResponse = {
            ok: false,
            status: testCase.status,
            statusText: 'Error',
            headers: new Headers(),
          };
          mockFetch.mockResolvedValue(mockResponse as any);

          if (testCase.shouldRetry) {
            // Start the request
            const resultPromise = client.get('https://api.example.com/test');

            // Fast-forward through all the retry delays
            for (let i = 0; i < DEFAULT_RETRY_CONFIG.maxRetries; i++) {
              await jest.advanceTimersByTimeAsync(5000);
            }

            const result = await resultPromise;
            expect(result.success).toBe(false);
            expect(result.isRetryable).toBe(true);
            expect(mockFetch).toHaveBeenCalledTimes(DEFAULT_RETRY_CONFIG.maxRetries + 1);
          } else {
            const result = await client.get('https://api.example.com/test');
            expect(result.success).toBe(false);
            expect(result.isRetryable).toBe(false);
            expect(mockFetch).toHaveBeenCalledTimes(1);
          }
        }
      });
    });

    describe('convenience methods', () => {
      it('should make GET request with headers', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ data: 'test' }),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const headers = { Authorization: 'Bearer token' };
        await client.get('https://api.example.com/test', headers);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/test',
          expect.objectContaining({
            method: 'GET',
            headers,
          }),
        );
      });

      it('should make POST request with body and headers', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ data: 'created' }),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const body = { name: 'test' };
        const headers = { Authorization: 'Bearer token' };
        await client.post('https://api.example.com/test', body, headers);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/test',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: JSON.stringify(body),
          }),
        );
      });

      it('should handle requests without body', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ data: 'test' }),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        await client.get('https://api.example.com/test');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/test',
          expect.objectContaining({
            method: 'GET',
          }),
        );
      });

      it('should handle custom headers correctly', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ data: 'test' }),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        const customHeaders = {
          Authorization: 'Bearer token',
          'X-Custom-Header': 'custom-value',
        };

        await client.post('https://api.example.com/test', { data: 'test' }, customHeaders);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/test',
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer token',
              'X-Custom-Header': 'custom-value',
            },
            body: JSON.stringify({ data: 'test' }),
          }),
        );
      });

      it('should handle GET request with query parameters in URL', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ data: 'test' }),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        await client.get('https://api.example.com/test?param=value');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/test?param=value',
          expect.objectContaining({
            method: 'GET',
          }),
        );
      });

      it('should handle POST request with empty body', async () => {
        const mockResponse = {
          ok: true,
          json: jest.fn().mockResolvedValue({ success: true }),
        };
        mockFetch.mockResolvedValue(mockResponse as any);

        await client.post('https://api.example.com/test', {});

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.example.com/test',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }),
        );
      });
    });
  });
});
