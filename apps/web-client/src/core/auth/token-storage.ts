/**
 * Token Storage Module
 *
 * @module core/auth/token-storage
 *
 * ## Current Strategy
 *
 * Both access and refresh tokens are stored in **localStorage**.
 * This approach was chosen for simplicity and to support the following use cases:
 * - Persistence across browser tabs
 * - Persistence across page refreshes
 * - Simple implementation without server-side session management
 *
 * ## Security Trade-offs
 *
 * ### localStorage Storage (Current Implementation)
 *
 * **Advantages:**
 * - Tokens persist across page refreshes and browser restarts
 * - Works seamlessly with SSR/SSG (tokens available on client hydration)
 * - Simple implementation, no server-side session management needed
 * - Tokens accessible across all tabs of the same origin
 *
 * **Risks:**
 * - **XSS Vulnerability:** If an attacker injects malicious JavaScript (XSS attack),
 *   they can read tokens from localStorage and exfiltrate them
 * - **No automatic expiry:** Tokens remain until explicitly cleared
 * - **Accessible to all JS:** Any JavaScript running on the page can access tokens
 *
 * ### Alternative: Memory Storage for Access Token
 *
 * **Advantages:**
 * - Access token not accessible after page refresh (limits exposure window)
 * - XSS attack can only use token during current session, cannot exfiltrate for later use
 * - Follows security best practice of minimizing token exposure
 *
 * **Disadvantages:**
 * - Token lost on page refresh (requires silent refresh on every page load)
 * - More complex implementation (need to handle token restoration)
 * - Potential UX impact (brief loading state on page refresh)
 *
 * ### Alternative: httpOnly Cookies
 *
 * **Advantages:**
 * - Not accessible to JavaScript at all (immune to XSS token theft)
 * - Automatic expiry via cookie attributes
 * - Can be scoped to specific paths
 *
 * **Disadvantages:**
 * - Requires server-side changes (API must set cookies)
 * - CSRF protection becomes necessary
 * - More complex CORS configuration
 * - Not suitable for pure SPA without backend proxy
 *
 * ## Recommendation
 *
 * For applications with sensitive data, consider:
 * 1. Access token in memory (React state) - limits XSS exposure
 * 2. Refresh token in httpOnly cookie - prevents token theft
 * 3. Short access token TTL (5-15 minutes) - limits damage window
 *
 * Current implementation prioritizes simplicity over maximum security.
 * Ensure robust XSS prevention (CSP headers, input sanitization) to mitigate risks.
 *
 * @see {@link https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html OWASP JWT Cheat Sheet}
 * @see {@link https://auth0.com/docs/secure/tokens/token-storage Auth0 Token Storage Guide}
 */

const ACCESS_TOKEN_KEY = 'ratingo_access_token';
const REFRESH_TOKEN_KEY = 'ratingo_refresh_token';

/**
 * Checks if code is running in browser environment.
 * Required for SSR safety - localStorage is not available on server.
 *
 * @returns {boolean} True if running in browser, false if server-side
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Token storage operations.
 *
 * Provides a unified interface for storing and retrieving authentication tokens.
 * All operations are SSR-safe and will no-op on server-side rendering.
 *
 * @example
 * ```typescript
 * // Store tokens after login
 * tokenStorage.setTokens(accessToken, refreshToken);
 *
 * // Get access token for API requests
 * const token = tokenStorage.getAccessToken();
 * if (token) {
 *   headers.set('Authorization', `Bearer ${token}`);
 * }
 *
 * // Clear tokens on logout
 * tokenStorage.clearTokens();
 * ```
 */
export const tokenStorage = {
  /**
   * Retrieves the access token from localStorage.
   *
   * @returns {string | null} The access token if present, null otherwise
   *
   * @remarks
   * - Returns null during SSR (server-side rendering)
   * - Access token is used for API authorization (Bearer token)
   * - Consider short TTL (5-15 min) for access tokens
   */
  getAccessToken(): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  /**
   * Retrieves the refresh token from localStorage.
   *
   * @returns {string | null} The refresh token if present, null otherwise
   *
   * @remarks
   * - Returns null during SSR (server-side rendering)
   * - Refresh token is used to obtain new access tokens
   * - Should have longer TTL than access token (days/weeks)
   * - Consider httpOnly cookie storage for production
   */
  getRefreshToken(): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  /**
   * Stores both access and refresh tokens in localStorage.
   *
   * @param {string} accessToken - The JWT access token for API authorization
   * @param {string} refreshToken - The refresh token for obtaining new access tokens
   *
   * @remarks
   * - No-op during SSR (server-side rendering)
   * - Both tokens are stored synchronously
   * - Overwrites any existing tokens
   */
  setTokens(accessToken: string, refreshToken: string): void {
    if (!isBrowser()) return;
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  /**
   * Removes all tokens from localStorage.
   *
   * @remarks
   * - No-op during SSR (server-side rendering)
   * - Should be called on logout or when refresh fails
   * - Clears both access and refresh tokens atomically
   */
  clearTokens(): void {
    if (!isBrowser()) return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  /**
   * Checks if both tokens exist in storage.
   *
   * @returns {boolean} True if both access and refresh tokens are present
   *
   * @remarks
   * - Returns false during SSR
   * - Useful for initial auth state determination
   * - Does not validate token expiry or format
   */
  hasTokens(): boolean {
    return !!this.getAccessToken() && !!this.getRefreshToken();
  },
} as const;
