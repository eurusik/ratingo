/**
 * Property-based tests for single-flight token refresh.
 */

import * as fc from 'fast-check';
import {
  refreshTokens,
  isRefreshInProgress,
  isRefreshEndpoint,
  _resetRefreshState,
} from '../refresh';
import { tokenStorage } from '../token-storage';
import { authApi } from '../../api/auth';

// Mock dependencies
jest.mock('../token-storage', () => ({
  tokenStorage: {
    getRefreshToken: jest.fn(),
    setTokens: jest.fn(),
    clearTokens: jest.fn(),
  },
}));

jest.mock('../../api/auth', () => ({
  authApi: {
    refresh: jest.fn(),
  },
}));

const mockTokenStorage = tokenStorage as jest.Mocked<typeof tokenStorage>;
const mockAuthApi = authApi as jest.Mocked<typeof authApi>;

describe('Single-flight token refresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetRefreshState();
  });

  /**
   * Property 1: Single-flight refresh guarantees one request
   *
   * For any number of concurrent 401 responses (N ≥ 1), calling refreshTokens()
   * N times concurrently SHALL result in exactly one HTTP request to the refresh endpoint.
   */
  it('Property 1: concurrent refresh calls result in exactly one API request', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 20 }), // Number of concurrent calls
        fc.string({ minLength: 1 }), // Refresh token
        fc.string({ minLength: 1 }), // New access token
        fc.string({ minLength: 1 }), // New refresh token
        async (concurrentCalls, refreshToken, newAccessToken, newRefreshToken) => {
          // Reset state before each test
          _resetRefreshState();
          jest.clearAllMocks();

          // Setup mocks
          mockTokenStorage.getRefreshToken.mockReturnValue(refreshToken);

          // Create a delayed promise to simulate network latency
          let resolveRefresh: (value: unknown) => void;
          const refreshPromise = new Promise((resolve) => {
            resolveRefresh = resolve;
          });

          mockAuthApi.refresh.mockReturnValue(
            refreshPromise.then(() => ({
              accessToken: newAccessToken,
              refreshToken: newRefreshToken,
            })) as Promise<{ accessToken: string; refreshToken: string }>,
          );

          // Make N concurrent calls
          const promises = Array.from({ length: concurrentCalls }, () => refreshTokens());

          // Resolve the refresh
          resolveRefresh!(undefined);

          // Wait for all to complete
          const results = await Promise.all(promises);

          // Property: exactly one API call regardless of concurrent calls
          expect(mockAuthApi.refresh).toHaveBeenCalledTimes(1);

          // All calls should return the same tokens
          results.forEach((result) => {
            expect(result.accessToken).toBe(newAccessToken);
            expect(result.refreshToken).toBe(newRefreshToken);
          });

          // Tokens should be stored exactly once
          expect(mockTokenStorage.setTokens).toHaveBeenCalledTimes(1);
          expect(mockTokenStorage.setTokens).toHaveBeenCalledWith(newAccessToken, newRefreshToken);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: isRefreshInProgress returns true during refresh
   */
  it('isRefreshInProgress reflects actual refresh state', async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ minLength: 1 }), async (refreshToken) => {
        _resetRefreshState();
        jest.clearAllMocks();

        mockTokenStorage.getRefreshToken.mockReturnValue(refreshToken);

        let resolveRefresh: (value: unknown) => void;
        const refreshPromise = new Promise((resolve) => {
          resolveRefresh = resolve;
        });

        mockAuthApi.refresh.mockReturnValue(
          refreshPromise.then(() => ({
            accessToken: 'new-access',
            refreshToken: 'new-refresh',
          })) as Promise<{ accessToken: string; refreshToken: string }>,
        );

        // Before refresh
        expect(isRefreshInProgress()).toBe(false);

        // Start refresh
        const promise = refreshTokens();

        // During refresh
        expect(isRefreshInProgress()).toBe(true);

        // Complete refresh
        resolveRefresh!(undefined);
        await promise;

        // After refresh
        expect(isRefreshInProgress()).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property: isRefreshEndpoint correctly identifies refresh URLs
   */
  it('isRefreshEndpoint identifies refresh endpoint URLs', () => {
    fc.assert(
      fc.property(
        fc.string(), // Base URL
        fc.string(), // Path prefix
        (baseUrl, pathPrefix) => {
          const refreshUrl = `${baseUrl}${pathPrefix}auth/refresh`;
          const otherUrl = `${baseUrl}${pathPrefix}auth/login`;

          expect(isRefreshEndpoint(refreshUrl)).toBe(true);
          expect(isRefreshEndpoint(otherUrl)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: refreshTokens throws when no refresh token available
   */
  it('throws error when no refresh token is available', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        _resetRefreshState();
        jest.clearAllMocks();

        mockTokenStorage.getRefreshToken.mockReturnValue(null);

        await expect(refreshTokens()).rejects.toThrow('No refresh token available');
        expect(mockAuthApi.refresh).not.toHaveBeenCalled();
      }),
      { numRuns: 100 },
    );
  });
});
