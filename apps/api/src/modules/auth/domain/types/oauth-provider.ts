/**
 * Supported OAuth provider identifiers.
 * Used as discriminator in oauth_accounts table and guard routing.
 */
export const OAUTH_PROVIDER = {
  GOOGLE: 'google',
  FACEBOOK: 'facebook',
  APPLE: 'apple',
} as const;

export type OAuthProvider = (typeof OAUTH_PROVIDER)[keyof typeof OAUTH_PROVIDER];

/**
 * Type guard for OAuthProvider.
 */
export function isOAuthProvider(value: string): value is OAuthProvider {
  return Object.values(OAUTH_PROVIDER).includes(value as OAuthProvider);
}
