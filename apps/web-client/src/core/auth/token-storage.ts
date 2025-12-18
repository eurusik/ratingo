/**
 * Token storage utilities for auth tokens.
 * Uses localStorage with SSR safety checks.
 */

const ACCESS_TOKEN_KEY = 'ratingo_access_token';
const REFRESH_TOKEN_KEY = 'ratingo_refresh_token';

/** Checks if running in browser environment. */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/** Token storage operations. */
export const tokenStorage = {
  /** Gets access token from storage. */
  getAccessToken(): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  /** Gets refresh token from storage. */
  getRefreshToken(): string | null {
    if (!isBrowser()) return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  /** Saves both tokens to storage. */
  setTokens(accessToken: string, refreshToken: string): void {
    if (!isBrowser()) return;
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  /** Clears all tokens from storage. */
  clearTokens(): void {
    if (!isBrowser()) return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },

  /** Checks if tokens exist in storage. */
  hasTokens(): boolean {
    return !!this.getAccessToken() && !!this.getRefreshToken();
  },
} as const;
