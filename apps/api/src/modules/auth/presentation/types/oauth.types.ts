import { type OAuthStatePayload } from '@/modules/auth/domain/types';

export type { OAuthStatePayload } from '@/modules/auth/domain/types';

// Module augmentation for Fastify
declare module 'fastify' {
  interface FastifyRequest {
    /** Signed state string for OAuth initiation */
    oauthState?: string;
    /** Decoded state payload after callback validation */
    oauthStatePayload?: OAuthStatePayload;
  }
}
