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
 * import { apiGet } from '@ratingo/web-core/api';
 * const shows = await apiGet<ShowListItemDto[]>('catalog/shows/trending');
 */

import ky, { type Options, type KyInstance } from 'ky';
import { ApiError, type ApiErrorDetail } from './error';
import { refreshTokens, isRefreshEndpoint } from '../auth/refresh';
import { tokenStorage } from '../auth/token-storage';

/** Token getter function type for auth injection. */
type TokenGetter = () => string | null;

let tokenGetter: TokenGetter = () => null;

export interface ApiClientConfig {
  baseUrl: string;
}

let clientConfig: ApiClientConfig | null = null;
let client: KyInstance | null = null;

export function configureApiClient(config: ApiClientConfig): void {
  if (clientConfig?.baseUrl === config.baseUrl) return;
  clientConfig = config;
  client = null;
}

function configuredBaseUrl(): string {
  if (!clientConfig) {
    throw new Error('API client is not configured: call configureApiClient({ baseUrl }) first');
  }
  return clientConfig.baseUrl;
}

/**
 * Sets the token getter for authenticated requests.
 *
 * @param getter - Function that returns current access token
 */
export function setTokenGetter(getter: TokenGetter): void {
  tokenGetter = getter;
}

/** API response wrapper from backend. */
export interface ApiResponse<T> {
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
    prefixUrl: configuredBaseUrl(),
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
      beforeError: [
        async (error) => {
          try {
            const body = (await error.response.clone().json()) as { error?: ApiErrorDetail };
            if (body?.error?.code) {
              throw ApiError.fromResponse(body.error);
            }
          } catch (e) {
            if (e instanceof ApiError) throw e;
          }
          return error;
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
          } catch (error) {
            // Only clear tokens on a definitive auth rejection from the backend.
            // Network errors or 5xx failures are transient — leave tokens intact
            // so the user is not logged out unnecessarily.
            if (error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403)) {
              tokenStorage.clearTokens();
              window.dispatchEvent(new CustomEvent('auth:unauthorized'));
            }
            // For all other failures (network, 5xx, etc.) return the original
            // 401 response without clearing tokens — the user can retry on the
            // next page load once connectivity is restored.
            return response;
          }
        },
      ],
    },
  });
}

/** Gets or creates the ky client instance. */
function getClient(): KyInstance {
  client ??= createClient();
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
      response.error ?? { code: 'UNKNOWN', message: 'Unknown error', statusCode: 500 },
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

export async function apiGetOrNull<T>(path: string, options?: Options): Promise<T | null> {
  const response = await getClient().get(path, options).json<ApiResponse<T | null>>();
  if (response.success && response.data === null) return null;
  return handleResponse(Promise.resolve(response as ApiResponse<T>));
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
  const response = await getClient().post(path, { json, ...options });

  // Handle 204 No Content - return void
  if (response.status === 204) {
    return undefined as T;
  }

  return handleResponse(response.json<ApiResponse<T>>());
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
 * @returns Response data (or void for 204 No Content)
 * @throws {ApiError} When API returns error response
 */
export async function apiDelete<T = void>(path: string, options?: Options): Promise<T> {
  const response = await getClient().delete(path, options);

  // Handle 204 No Content - return void
  if (response.status === 204) {
    return undefined as T;
  }

  return handleResponse(response.json<ApiResponse<T>>());
}
