/**
 * Cross-Tab Token Synchronization
 *
 * Prevents race conditions when multiple tabs try to refresh tokens
 * simultaneously. Uses BroadcastChannel for coordination.
 *
 * @module core/auth/cross-tab-sync
 */

import { tokenStorage } from './token-storage';

/** Channel name for auth coordination */
const CHANNEL_NAME = 'ratingo-auth-sync';

/** Message types for cross-tab communication */
type AuthSyncMessage =
  | { type: 'REFRESH_START' }
  | { type: 'REFRESH_SUCCESS'; accessToken: string; refreshToken: string }
  | { type: 'REFRESH_FAILED' }
  | { type: 'LOGOUT' };

/** BroadcastChannel instance */
let channel: BroadcastChannel | null = null;

/** Callback for when tokens are updated from another tab */
type TokensUpdatedCallback = () => void;
let onTokensUpdated: TokensUpdatedCallback | null = null;

/** Callback for when logout happens in another tab */
type LogoutCallback = () => void;
let onLogout: LogoutCallback | null = null;

/**
 * Initializes cross-tab synchronization.
 *
 * @param callbacks - Callbacks for sync events
 */
export function initCrossTabSync(callbacks: {
  onTokensUpdated?: TokensUpdatedCallback;
  onLogout?: LogoutCallback;
}): void {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return;
  }

  onTokensUpdated = callbacks.onTokensUpdated ?? null;
  onLogout = callbacks.onLogout ?? null;

  channel = new BroadcastChannel(CHANNEL_NAME);

  channel.onmessage = (event: MessageEvent<AuthSyncMessage>) => {
    const message = event.data;

    switch (message.type) {
      case 'REFRESH_SUCCESS':
        // Another tab refreshed tokens, update our storage
        tokenStorage.setTokens(message.accessToken, message.refreshToken);
        onTokensUpdated?.();
        break;

      case 'LOGOUT':
        // Another tab logged out, clear our tokens
        tokenStorage.clearTokens();
        onLogout?.();
        break;
    }
  };
}

/**
 * Broadcasts that refresh has started.
 * Other tabs can wait instead of starting their own refresh.
 */
export function broadcastRefreshStart(): void {
  channel?.postMessage({ type: 'REFRESH_START' } satisfies AuthSyncMessage);
}

/**
 * Broadcasts successful token refresh to other tabs.
 *
 * @param accessToken - New access token
 * @param refreshToken - New refresh token
 */
export function broadcastRefreshSuccess(accessToken: string, refreshToken: string): void {
  channel?.postMessage({
    type: 'REFRESH_SUCCESS',
    accessToken,
    refreshToken,
  } satisfies AuthSyncMessage);
}

/**
 * Broadcasts that refresh failed.
 */
export function broadcastRefreshFailed(): void {
  channel?.postMessage({ type: 'REFRESH_FAILED' } satisfies AuthSyncMessage);
}

/**
 * Broadcasts logout to other tabs.
 */
export function broadcastLogout(): void {
  channel?.postMessage({ type: 'LOGOUT' } satisfies AuthSyncMessage);
}

/**
 * Cleans up cross-tab sync resources.
 */
export function destroyCrossTabSync(): void {
  channel?.close();
  channel = null;
  onTokensUpdated = null;
  onLogout = null;
}
