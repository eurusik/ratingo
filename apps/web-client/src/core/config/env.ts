/**
 * Environment configuration for the web-client application.
 *
 * @example
 * import { env, getApiUrl } from '@/core/config';
 * const url = getApiUrl('/catalog/shows/trending');
 */

/** Application environment variables. */
export const env = {
  /** Backend API base URL. */
  API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  /** API path prefix. */
  API_PREFIX: '/api',
  /** Public site URL for meta tags and redirects. */
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3002',
  /** Development mode flag. */
  IS_DEV: process.env.NODE_ENV === 'development',
  /** Production mode flag. */
  IS_PROD: process.env.NODE_ENV === 'production',
} as const;

/**
 * Constructs full API URL from path.
 *
 * @param path - API endpoint path (with or without leading slash)
 * @returns Full URL to the API endpoint
 *
 * @example
 * getApiUrl('/catalog/shows') // => 'http://localhost:3001/api/catalog/shows'
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${env.API_URL}${env.API_PREFIX}/${cleanPath}`;
}
