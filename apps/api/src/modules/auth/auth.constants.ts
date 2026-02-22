/**
 * OAuth-related constants for authentication module.
 */

import { MS_PER_MINUTE } from '../../common/constants';

/** Cookie name for OAuth state */
export const OAUTH_STATE_COOKIE = 'oauth_state';

/** State TTL in minutes */
const STATE_TTL_MINUTES = 5;

/** State TTL in milliseconds */
export const OAUTH_STATE_TTL_MS = STATE_TTL_MINUTES * MS_PER_MINUTE;

/** Exchange code TTL in milliseconds (60 seconds) */
export const EXCHANGE_CODE_TTL_MS = MS_PER_MINUTE;

/** Exchange code size in bytes (256 bits of entropy) */
export const EXCHANGE_CODE_SIZE_BYTES = 32;

/** Retention period for expired exchange codes in hours */
export const EXCHANGE_CODE_EXPIRED_RETENTION_HOURS = 24;

/** Retention period for used exchange codes in hours */
export const EXCHANGE_CODE_USED_RETENTION_HOURS = 1;

/** Username generation constants */
export const USERNAME_MAX_BASE_LENGTH = 24;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_SUFFIX_LENGTH = 6;
export const USERNAME_MAX_ATTEMPTS = 10;
export const USERNAME_FALLBACK_SUFFIX_LENGTH = 12;
export const USERNAME_RANDOM_BYTES = 4;
export const BASE_36 = 36;

/** HTTP redirect status code */
export const HTTP_REDIRECT_FOUND = 302;

/** Nonce size in bytes for state generation */
export const OAUTH_NONCE_SIZE_BYTES = 16;

/** Pattern for validating returnTo paths (relative paths only) */
export const RETURN_TO_PATTERN = /^\/[a-zA-Z0-9/_\-?=&.]*$/;

/** Google OAuth authorization URL */
export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

/** OAuth cookie path for Google auth endpoints */
export const GOOGLE_AUTH_COOKIE_PATH = '/api/auth';

/** Google OAuth scopes */
export const GOOGLE_OAUTH_SCOPES = 'email profile openid';

/**
 * OAuth error codes for state and flow management.
 */
export const OAuthErrorCode = {
  CANCELLED: 'OAUTH_CANCELLED',
  STATE_INVALID: 'OAUTH_STATE_INVALID',
  PROVIDER_ERROR: 'OAUTH_PROVIDER_ERROR',
  EMAIL_NOT_VERIFIED: 'OAUTH_EMAIL_NOT_VERIFIED',
} as const;

/**
 * Google OAuth error responses from provider.
 */
export const GoogleOAuthError = {
  ACCESS_DENIED: 'access_denied',
} as const;

/**
 * Google OAuth request parameters.
 */
export const GoogleOAuthParams = {
  RESPONSE_TYPE: 'code',
  ACCESS_TYPE: 'offline',
  PROMPT: 'select_account',
} as const;

/** Facebook OAuth authorization URL */
export const FACEBOOK_AUTH_URL = 'https://www.facebook.com/v19.0/dialog/oauth';

/** OAuth cookie path for Facebook auth endpoints */
export const FACEBOOK_AUTH_COOKIE_PATH = '/api/auth';

/** Facebook OAuth scopes */
export const FACEBOOK_OAUTH_SCOPES = 'email';

/**
 * Facebook OAuth error responses from provider.
 */
export const FacebookOAuthError = {
  ACCESS_DENIED: 'access_denied',
} as const;

/**
 * Facebook OAuth request parameters.
 */
export const FacebookOAuthParams = {
  RESPONSE_TYPE: 'code',
  DISPLAY: 'popup',
} as const;
