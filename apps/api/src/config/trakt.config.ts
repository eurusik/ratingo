import { registerAs } from '@nestjs/config';

export const TRAKT_DEFAULT_API_URL = 'https://api.trakt.tv';

/**
 * Trakt API Configuration namespace.
 */
export default registerAs('trakt', () => ({
  clientId: process.env.TRAKT_CLIENT_ID,
  clientSecret: process.env.TRAKT_CLIENT_SECRET,
  apiUrl: process.env.TRAKT_API_URL || TRAKT_DEFAULT_API_URL,
  userAgent: process.env.TRAKT_USER_AGENT || 'Ratingo/1.0.0',
}));
