/**
 * HTTP client for communicating with the Ratingo API.
 *
 * Uses `ky` for HTTP requests and types from `@ratingo/api-contract`.
 * Supports lazy initialization and token injection for auth.
 *
 * Features:
 * - Automatic token injection via beforeRequest hook
 * - Single-flight token refresh on 401 responses
 * - Idempotent request retry after successful refresh
 * - Refresh loop prevention (no retry on refresh endpoint 401)
 *
 * @example
 * import { apiGet } from '@/core/api';
 * const shows = await apiGet<ShowListItemDto[]>('catalog/shows/trending');
 */

import ky, { type Options, type KyInstance } from 'ky';
import { env } from '../config/env';
import { ApiError, type ApiErrorDetail } from './error';
import { refreshTokens, isRefreshEndpoint } from '../auth/refresh';
import { tokenStorage } from '../auth/token-storage';

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
 * Tracks requests that have already been retried after 401.
 * Uses WeakSet to allow garbage collection of Request objects.
 */
const retriedRequests = new WeakSet<Request>();

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
        async (request, _options, response) => {
          // Skip handling in SSR
          if (typeof window === 'undefined') {
            return response;
          }

          // Handle 403 Forbidden (admin access denied)
          if (response.status === 403) {
            window.dispatchEvent(new CustomEvent('auth:forbidden'));
            return response;
          }

          // Only handle 401 from here
          if (response.status !== 401) {
            return response;
          }

          // Don't retry refresh endpoint (prevents infinite loop)
          if (isRefreshEndpoint(request.url)) {
            tokenStorage.clearTokens();
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            return response;
          }

          // Don't retry if already retried (prevents infinite retry loop)
          if (retriedRequests.has(request)) {
            tokenStorage.clearTokens();
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            return response;
          }

          try {
            // Single-flight refresh - all concurrent 401s share one refresh
            await refreshTokens();

            // Mark as retried to prevent infinite retry loop
            retriedRequests.add(request);

            // Clone request with new token (works for all methods including POST/PATCH/PUT)
            const newRequest = new Request(request, {
              headers: new Headers(request.headers),
            });
            newRequest.headers.set('Authorization', `Bearer ${tokenGetter()}`);

            // Retry the request once with new token
            return ky(newRequest);
          } catch {
            // Refresh failed, logout
            tokenStorage.clearTokens();
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            return response;
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
      response.error || { code: 'UNKNOWN', message: 'Unknown error', statusCode: 500 },
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
 * @throws {ApiError} When API returns error response
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
 * @throws {ApiError} When API returns error response
 */
export async function apiPost<T>(path: string, json?: unknown, options?: Options): Promise<T> {
  return handleResponse(
    getClient()
      .post(path, { json, ...options })
      .json<ApiResponse<T>>(),
  );
}

/**
 * Performs PATCH request to API.
 *
 * @param path - API endpoint path
 * @param json - Request body
 * @param options - Additional ky options
 * @returns Response data
 * @throws {ApiError} When API returns error response
 */
export async function apiPatch<T>(path: string, json?: unknown, options?: Options): Promise<T> {
  return handleResponse(
    getClient()
      .patch(path, { json, ...options })
      .json<ApiResponse<T>>(),
  );
}

/**
 * Performs PUT request to API.
 *
 * @param path - API endpoint path
 * @param json - Request body
 * @param options - Additional ky options
 * @returns Response data
 * @throws {ApiError} When API returns error response
 */
export async function apiPut<T>(path: string, json?: unknown, options?: Options): Promise<T> {
  return handleResponse(
    getClient()
      .put(path, { json, ...options })
      .json<ApiResponse<T>>(),
  );
}

/**
 * Performs DELETE request to API.
 *
 * @param path - API endpoint path
 * @param options - Additional ky options
 * @returns Response data
 * @throws {ApiError} When API returns error response
 */
export async function apiDelete<T>(path: string, options?: Options): Promise<T> {
  return handleResponse(getClient().delete(path, options).json<ApiResponse<T>>());
}
