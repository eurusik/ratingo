/**
 * Property-based tests for refresh loop prevention.
 */

import * as fc from 'fast-check';

// Mock the API client and error module to avoid ky (ESM) import issues
jest.mock('../client', () => ({
  apiPost: jest.fn(),
  apiGet: jest.fn(),
}));

jest.mock('../error', () => {
  class ApiError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.name = 'ApiError';
      this.statusCode = statusCode;
    }
  }
  return { ApiError };
});

// Import after mocking
import { isRefreshEndpoint } from '../../auth/refresh';

describe('Refresh loop prevention', () => {
  /**
   * Property 2: Refresh loop prevention
   *
   * For any 401 response from the refresh endpoint itself, the system
   * SHALL NOT attempt another refresh and SHALL immediately clear tokens.
   *
   * This test validates the isRefreshEndpoint detection which is the
   * foundation of loop prevention in the client's afterResponse hook.
   */
  it('Property 2: isRefreshEndpoint correctly identifies refresh URLs to prevent loops', () => {
    fc.assert(
      fc.property(
        fc.webUrl(), // Random base URL
        fc.constantFrom('', '/api', '/api/v1', '/v1'), // API prefix variations
        (baseUrl, apiPrefix) => {
          // Refresh endpoint should always be detected
          const refreshUrl = `${baseUrl}${apiPrefix}/auth/refresh`;
          expect(isRefreshEndpoint(refreshUrl)).toBe(true);

          // Other auth endpoints should NOT be detected as refresh
          const loginUrl = `${baseUrl}${apiPrefix}/auth/login`;
          const registerUrl = `${baseUrl}${apiPrefix}/auth/register`;
          const meUrl = `${baseUrl}${apiPrefix}/auth/me`;
          const logoutUrl = `${baseUrl}${apiPrefix}/auth/logout`;

          expect(isRefreshEndpoint(loginUrl)).toBe(false);
          expect(isRefreshEndpoint(registerUrl)).toBe(false);
          expect(isRefreshEndpoint(meUrl)).toBe(false);
          expect(isRefreshEndpoint(logoutUrl)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Refresh endpoint detection is case-sensitive
   */
  it('refresh endpoint detection handles various URL formats', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('http://localhost:3000', 'https://api.example.com', 'https://ratingo.app'),
        fc.constantFrom('', '/api', '/api/v1'),
        (baseUrl, prefix) => {
          // Standard refresh URL
          expect(isRefreshEndpoint(`${baseUrl}${prefix}/auth/refresh`)).toBe(true);

          // With query params
          expect(isRefreshEndpoint(`${baseUrl}${prefix}/auth/refresh?foo=bar`)).toBe(true);

          // Partial match should still work (contains check)
          expect(isRefreshEndpoint(`${baseUrl}${prefix}/auth/refresh/extra`)).toBe(true);

          // Non-refresh endpoints
          expect(isRefreshEndpoint(`${baseUrl}${prefix}/catalog/movies`)).toBe(false);
          expect(isRefreshEndpoint(`${baseUrl}${prefix}/users/me`)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Property: Empty or malformed URLs don't cause errors
   */
  it('handles edge case URLs gracefully', () => {
    fc.assert(
      fc.property(fc.string(), (randomString) => {
        // Should not throw for any string input
        const result = isRefreshEndpoint(randomString);
        expect(typeof result).toBe('boolean');

        // Only returns true if contains 'auth/refresh'
        if (randomString.includes('auth/refresh')) {
          expect(result).toBe(true);
        } else {
          expect(result).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});
