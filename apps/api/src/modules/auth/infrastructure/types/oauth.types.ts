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

// Module augmentation for Fastify
declare module 'fastify' {
  interface FastifyRequest {
    /** Signed state string for OAuth initiation */
    oauthState?: string;
    /** Decoded state payload after callback validation */
    oauthStatePayload?: OAuthStatePayload;
  }
}
