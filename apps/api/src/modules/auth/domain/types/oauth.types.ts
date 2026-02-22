import { type OAuthProvider } from './oauth-provider';

/**
 * Unified user payload extracted from any OAuth provider after successful auth.
 */
export interface OAuthUserPayload {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  name: string;
  picture: string | null;
}

/**
 * OAuth state payload stored in signed cookie during OAuth flow.
 */
export interface OAuthStatePayload {
  /** Random nonce for uniqueness */
  nonce: string;
  /** URL to redirect after successful auth */
  returnTo: string;
  /** Expiration timestamp (ms) */
  exp: number;
  /** OAuth provider for this flow (optional during migration, required in BaseOAuthGuard) */
  provider?: OAuthProvider;
  /** Flow mode: login/register or link to existing account */
  mode?: 'login' | 'link';
  /** User ID when mode is 'link' (set from JWT before redirect) */
  linkUserId?: string;
}
