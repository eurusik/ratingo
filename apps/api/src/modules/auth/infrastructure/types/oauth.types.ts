import { type OAuthStatePayload } from '../../domain/types';

export type { OAuthStatePayload } from '../../domain/types';

// Module augmentation for Fastify
declare module 'fastify' {
  interface FastifyRequest {
    /** Signed state string for OAuth initiation */
    oauthState?: string;
    /** Decoded state payload after callback validation */
    oauthStatePayload?: OAuthStatePayload;
  }
}
