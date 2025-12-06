import { registerAs } from '@nestjs/config';

/**
 * Trakt API Configuration namespace.
 */
export default registerAs('trakt', () => ({
  clientId: process.env.TRAKT_CLIENT_ID,
  clientSecret: process.env.TRAKT_CLIENT_SECRET,
  apiUrl: process.env.TRAKT_API_URL || 'https://api.trakt.tv',
}));
