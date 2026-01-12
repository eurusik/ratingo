/**
 * Proactive Token Refresh Module
 *
 * Schedules token refresh BEFORE expiration to prevent 401 errors.
 * This eliminates most "silent logout" issues by keeping tokens fresh.
 *
 * @module core/auth/proactive-refresh
 */

import { jwtDecode } from 'jwt-decode';
import { tokenStorage } from './token-storage';
import { refreshTokens } from './refresh';

/** JWT payload with expiration claim */
interface JwtPayload {
  exp: number;
}

/** Buffer time before expiration to trigger refresh (60 seconds) */
const REFRESH_BUFFER_MS = 60 * 1000;

/** Minimum delay to prevent tight refresh loops */
const MIN_REFRESH_DELAY_MS = 5 * 1000;

/** Timer ID for scheduled refresh */
let refreshTimerId: ReturnType<typeof setTimeout> | null = null;

/**
 * Schedules proactive token refresh before expiration.
 *
 * Decodes the access token to get expiration time, then schedules
 * a refresh 60 seconds before it expires. After successful refresh,
 * automatically schedules the next refresh.
 *
 * @example
 * // Call after login or successful refresh
 * scheduleProactiveRefresh();
 */
export function scheduleProactiveRefresh(): void {
  // Clear any existing timer
  cancelProactiveRefresh();

  const accessToken = tokenStorage.getAccessToken();
  if (!accessToken) return;

  try {
    const { exp } = jwtDecode<JwtPayload>(accessToken);
    const expiresAtMs = exp * 1000;
    const refreshAtMs = expiresAtMs - REFRESH_BUFFER_MS;
    const delay = Math.max(MIN_REFRESH_DELAY_MS, refreshAtMs - Date.now());

    refreshTimerId = setTimeout(async () => {
      try {
        await refreshTokens();
        // Schedule next refresh after successful refresh
        scheduleProactiveRefresh();
      } catch {
        // Refresh failed - user will be logged out on next 401
        // Don't retry here to avoid infinite loops
      }
    }, delay);
  } catch {
    // Invalid token format, ignore
  }
}

/**
 * Cancels any scheduled proactive refresh.
 *
 * Should be called on logout to prevent refresh attempts
 * after user has logged out.
 */
export function cancelProactiveRefresh(): void {
  if (refreshTimerId !== null) {
    clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }
}

/**
 * Gets time until next scheduled refresh (for debugging).
 *
 * @returns Milliseconds until next refresh, or null if not scheduled
 */
export function getTimeUntilRefresh(): number | null {
  const accessToken = tokenStorage.getAccessToken();
  if (!accessToken) return null;

  try {
    const { exp } = jwtDecode<JwtPayload>(accessToken);
    const expiresAtMs = exp * 1000;
    const refreshAtMs = expiresAtMs - REFRESH_BUFFER_MS;
    return Math.max(0, refreshAtMs - Date.now());
  } catch {
    return null;
  }
}
