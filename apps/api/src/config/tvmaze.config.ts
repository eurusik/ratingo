import { registerAs } from '@nestjs/config';

export const TVMAZE_DEFAULT_API_URL = 'https://api.tvmaze.com';

/**
 * TVMaze API Configuration namespace.
 */
export default registerAs('tvmaze', () => ({
  apiUrl: process.env.TVMAZE_API_URL || TVMAZE_DEFAULT_API_URL,
}));
