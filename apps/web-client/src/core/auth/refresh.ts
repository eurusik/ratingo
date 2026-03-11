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
import { ApiError } from '../api/error';

/**
 * Singleton promise for in-flight refresh.
 * When set, all concurrent refresh attempts will await this promise.
 */
let refreshPromise: Promise<AuthTokensDto> | null = null;

/**
 * Returns true when the error is a definitive auth rejection from the backend
 * (401 or 403), meaning the refresh token is no longer valid.
 * Network failures, timeouts, and 5xx errors are NOT definitive.
 */
function isDefinitiveAuthFailure(error: unknown): boolean {
  return error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403);
}

/**
 * Performs a single refresh attempt against the backend.
 * On success, persists the new tokens and returns them.
 */
async function attemptRefresh(refreshToken: string): Promise<AuthTokensDto> {
  const tokens = await authApi.refresh({ refreshToken });
  tokenStorage.setTokens(tokens.accessToken, tokens.refreshToken);
  broadcastRefreshSuccess(tokens.accessToken, tokens.refreshToken);
  return tokens;
}

/**
 * Performs single-flight token refresh with one retry for transient failures.
 *
 * If a refresh is already in progress, returns the existing promise.
 * Otherwise, initiates a new refresh request.
 *
 * - On success: stores new tokens and notifies other tabs.
 * - On definitive auth failure (401/403): throws immediately (no retry).
 * - On network/server error: waits 1 second and retries once before throwing.
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

  refreshPromise = attemptRefresh(refreshToken)
    .catch(async (firstError: unknown) => {
      // Do not retry on definitive auth failures — the token is invalid
      if (isDefinitiveAuthFailure(firstError)) {
        throw firstError;
      }

      // Transient failure (network error, 5xx, timeout) — retry once after 1s
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      return attemptRefresh(refreshToken);
    })
    .catch((error: unknown) => {
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
