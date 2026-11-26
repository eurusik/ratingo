import { registerAs } from '@nestjs/config';

export const TMDB_DEFAULT_API_URL = 'https://api.themoviedb.org/3';

/**
 * TMDB Configuration namespace.
 * Best practice: Group related env vars into a typed object.
 */
export default registerAs('tmdb', () => ({
  apiUrl: process.env.TMDB_API_URL || TMDB_DEFAULT_API_URL,
  apiKey: process.env.TMDB_API_KEY,
}));
