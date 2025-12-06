import { registerAs } from '@nestjs/config';

/**
 * TMDB Configuration namespace.
 * Best practice: Group related env vars into a typed object.
 */
export default registerAs('tmdb', () => ({
  apiUrl: process.env.TMDB_API_URL || 'https://api.themoviedb.org/3',
  apiKey: process.env.TMDB_API_KEY,
}));
