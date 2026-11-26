import { registerAs } from '@nestjs/config';

export const OMDB_DEFAULT_API_URL = 'https://www.omdbapi.com';

/**
 * OMDb API Configuration namespace.
 */
export default registerAs('omdb', () => ({
  apiKey: process.env.OMDB_API_KEY,
  apiUrl: process.env.OMDB_API_URL || OMDB_DEFAULT_API_URL,
}));
