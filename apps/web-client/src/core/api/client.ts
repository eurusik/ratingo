/**
 * HTTP client for communicating with the Ratingo API.
 *
 * Uses `ky` for HTTP requests and types from `@ratingo/api-contract`.
 * Supports lazy initialization and token injection for auth.
 *
 * @example
 * import { apiGet } from '@/core/api';
 * const shows = await apiGet<ShowListItemDto[]>('catalog/shows/trending');
 */

import ky, { type Options, type KyInstance } from 'ky';
import { env } from '../config/env';
import { ApiError, type ApiErrorDetail } from './error';

/** Token getter function type for auth injection. */
type TokenGetter = () => string | null;

let tokenGetter: TokenGetter = () => null;

/**
 * Sets the token getter for authenticated requests.
 *
 * @param getter - Function that returns current access token
 */
export function setTokenGetter(getter: TokenGetter): void {
  tokenGetter = getter;
}

/** API response wrapper from backend. */
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiErrorDetail;
}

/**
 * Creates configured ky instance.
 * Lazy initialized on first request.
 */
function createClient(): KyInstance {
  return ky.create({
    prefixUrl: `${env.API_URL}${env.API_PREFIX}`,
    timeout: 15000,
    retry: {
      limit: 2,
      statusCodes: [408, 500, 502, 503, 504],
    },
    hooks: {
      beforeRequest: [
        (request) => {
          const token = tokenGetter();
          if (token) {
            request.headers.set('Authorization', `Bearer ${token}`);
          }
        },
      ],
      afterResponse: [
        async (_request, _options, response) => {
          if (response.status === 401 && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
          }
        },
      ],
    },
  });
}

let client: KyInstance | null = null;

/** Gets or creates the ky client instance. */
function getClient(): KyInstance {
  if (!client) {
    client = createClient();
  }
  return client;
}

/**
 * Handles API response and extracts data or throws error.
 *
 * @param promise - Promise returning ApiResponse
 * @returns Extracted data from response
 * @throws {ApiError} When API returns error response
 */
async function handleResponse<T>(promise: Promise<ApiResponse<T>>): Promise<T> {
  const response = await promise;

  if (!response.success || !response.data) {
    throw ApiError.fromResponse(
      response.error || { code: 'UNKNOWN', message: 'Unknown error', statusCode: 500 }
    );
  }

  return response.data;
}

/**
 * Performs GET request to API.
 *
 * @param path - API endpoint path (without /api prefix)
 * @param options - Additional ky options
 * @returns Response data
 *
 * @example
 * const shows = await apiGet<ShowListItemDto[]>('catalog/shows/trending', {
 *   searchParams: { limit: 20 },
 * });
 */
export async function apiGet<T>(path: string, options?: Options): Promise<T> {
  return handleResponse(getClient().get(path, options).json<ApiResponse<T>>());
}

/**
 * Performs POST request to API.
 *
 * @param path - API endpoint path
 * @param json - Request body
 * @param options - Additional ky options
 * @returns Response data
 */
export async function apiPost<T>(path: string, json?: unknown, options?: Options): Promise<T> {
  return handleResponse(getClient().post(path, { json, ...options }).json<ApiResponse<T>>());
}

/**
 * Performs PATCH request to API.
 *
 * @param path - API endpoint path
 * @param json - Request body
 * @param options - Additional ky options
 * @returns Response data
 */
export async function apiPatch<T>(path: string, json?: unknown, options?: Options): Promise<T> {
  return handleResponse(getClient().patch(path, { json, ...options }).json<ApiResponse<T>>());
}

/**
 * Performs PUT request to API.
 *
 * @param path - API endpoint path
 * @param json - Request body
 * @param options - Additional ky options
 * @returns Response data
 */
export async function apiPut<T>(path: string, json?: unknown, options?: Options): Promise<T> {
  return handleResponse(getClient().put(path, { json, ...options }).json<ApiResponse<T>>());
}

/**
 * Performs DELETE request to API.
 *
 * @param path - API endpoint path
 * @param options - Additional ky options
 * @returns Response data
 */
export async function apiDelete<T>(path: string, options?: Options): Promise<T> {
  return handleResponse(getClient().delete(path, options).json<ApiResponse<T>>());
}
