/**
 * User payload extracted from Google profile after successful OAuth.
 */
export interface GoogleUserPayload {
  googleId: string;
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
}
