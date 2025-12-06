import { registerAs } from '@nestjs/config';

/**
 * OMDb API Configuration namespace.
 */
export default registerAs('omdb', () => ({
  apiKey: process.env.OMDB_API_KEY,
  apiUrl: process.env.OMDB_API_URL || 'https://www.omdbapi.com',
}));
