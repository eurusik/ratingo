import { registerAs } from '@nestjs/config';

/**
 * TVMaze API Configuration namespace.
 */
export default registerAs('tvmaze', () => ({
  apiUrl: process.env.TVMAZE_API_URL || 'https://api.tvmaze.com',
}));
