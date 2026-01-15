/**
 * Single-flight token refresh manager.
 *
 * Ensures only one refresh request is in flight at a time.
 * When multiple requests receive 401 simultaneously, they all
 * wait for the same refresh promise instead of creating multiple requests.
 *
 * Also broadcasts refresh events to other tabs for coordination.
 *
 * @module core/auth/refresh
 */

import { authApi, type AuthTokensDto } from '../api/auth.client';
import { tokenStorage } from './token-storage';
import {
  broadcastRefreshStart,
  broadcastRefreshSuccess,
  broadcastRefreshFailed,
} from './cross-tab-sync';

/**
 * Singleton promise for in-flight refresh.
 * When set, all concurrent refresh attempts will await this promise.
 */
let refreshPromise: Promise<AuthTokensDto> | null = null;

/**
 * Performs single-flight token refresh.
 *
 * If a refresh is already in progress, returns the existing promise.
 * Otherwise, initiates a new refresh request.
 *
 * Broadcasts refresh events to other tabs for coordination.
 *
 * @returns Promise resolving to new tokens
 * @throws Error if refresh fails or no refresh token available
 *
 * @example
 * try {
 *   const tokens = await refreshTokens();
 *   // tokens.accessToken and tokens.refreshToken are now available
 * } catch (error) {
 *   // Handle refresh failure (e.g., logout user)
 * }
 */
export async function refreshTokens(): Promise<AuthTokensDto> {
  // Return existing promise if refresh in progress (single-flight pattern)
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  // Notify other tabs that refresh is starting
  broadcastRefreshStart();

  refreshPromise = authApi
    .refresh({ refreshToken })
    .then((tokens) => {
      tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
      // Notify other tabs about new tokens
      broadcastRefreshSuccess(tokens.accessToken, tokens.refreshToken);
      return tokens;
    })
    .catch((error) => {
      broadcastRefreshFailed();
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

/**
 * Checks if a refresh is currently in progress.
 *
 * Useful for UI components that need to show loading state
 * or prevent duplicate refresh attempts.
 *
 * @returns true if a refresh request is currently in flight
 */
export function isRefreshInProgress(): boolean {
  return refreshPromise !== null;
}

/**
 * Checks if the given URL is the refresh endpoint.
 *
 * Used to prevent refresh loops - if a 401 occurs on the refresh
 * endpoint itself, we should not attempt another refresh.
 *
 * @param url - The URL to check
 * @returns true if the URL is the auth refresh endpoint
 */
export function isRefreshEndpoint(url: string): boolean {
  return url.includes('auth/refresh');
}

/**
 * Resets the refresh state. Only for testing purposes.
 * @internal
 */
export function _resetRefreshState(): void {
  refreshPromise = null;
}
