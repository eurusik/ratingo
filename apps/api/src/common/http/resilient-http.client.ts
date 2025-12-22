import { Logger } from '@nestjs/common';

/**
 * Configuration for retry behavior.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelayMs: number;
  /** Maximum total time budget in ms (default: 30000) */
  maxTotalTimeMs: number;
  /** Request timeout in ms (default: 15000) */
  timeoutMs: number;
}

/**
 * Result of a fetch operation with retry metadata.
 */
export interface FetchResult<T> {
  data: T | null;
  success: boolean;
  attempts: number;
  error?: Error;
  /** True if error is retryable (429, 5xx, network) */
  isRetryable?: boolean;
}

/**
 * HTTP status codes that are retryable.
 */
const RETRYABLE_STATUS_CODES = new Set([
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

/**
 * HTTP status codes that should NOT be retried.
 */
const NON_RETRYABLE_STATUS_CODES = new Set([
  400, // Bad Request
  401, // Unauthorized
  403, // Forbidden
  404, // Not Found
  422, // Unprocessable Entity
]);

/**
 * Default retry configuration.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxTotalTimeMs: 30000,
  timeoutMs: 15000,
};

/**
 * Checks if an error/status is retryable.
 */
export function isRetryableError(error: any): boolean {
  // Network errors (no response)
  if (!error.status && error.name !== 'AbortError') {
    return true;
  }

  // Timeout
  if (error.name === 'AbortError' || error.status === 408) {
    return true;
  }

  // Check status code
  if (typeof error.status === 'number') {
    if (NON_RETRYABLE_STATUS_CODES.has(error.status)) {
      return false;
    }
    if (RETRYABLE_STATUS_CODES.has(error.status)) {
      return true;
    }
  }

  return false;
}

/**
 * Calculates delay with exponential backoff and jitter.
 * Formula: baseDelay * 2^attempt * (0.7 + random * 0.6)
 */
export function calculateBackoffDelay(attempt: number, baseDelayMs: number): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
  return Math.round(exponentialDelay * jitter);
}

/**
 * Extracts Retry-After header value in milliseconds.
 */
export function parseRetryAfter(headers: Headers): number | null {
  const retryAfter = headers.get('retry-after');
  if (!retryAfter) return null;

  // Try parsing as seconds (most common)
  const seconds = parseFloat(retryAfter);
  if (!isNaN(seconds)) {
    return Math.round(seconds * 1000);
  }

  // Try parsing as HTTP date
  const date = Date.parse(retryAfter);
  if (!isNaN(date)) {
    return Math.max(0, date - Date.now());
  }

  return null;
}

/**
 * Sleep utility.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Custom error class for HTTP errors with status code.
 */
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly headers?: Headers,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/**
 * Resilient HTTP client with retry logic, exponential backoff, and jitter.
 *
 * Features:
 * - Automatic retry for transient errors (429, 5xx, network errors)
 * - Exponential backoff with jitter to prevent thundering herd
 * - Respects Retry-After header
 * - Total time budget to prevent infinite retries
 * - Request timeout with AbortController
 * - Error classification (retryable vs non-retryable)
 */
export class ResilientHttpClient {
  private readonly logger = new Logger(ResilientHttpClient.name);
  private readonly config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Performs a fetch request with automatic retry for transient errors.
   *
   * @param url - URL to fetch
   * @param options - Fetch options
   * @returns FetchResult with data, success status, and metadata
   */
  async fetch<T>(url: string, options: RequestInit = {}): Promise<FetchResult<T>> {
    const startTime = Date.now();
    let lastError: Error | undefined;
    let attempts = 0;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      attempts = attempt + 1;

      // Check total time budget
      const elapsed = Date.now() - startTime;
      if (elapsed >= this.config.maxTotalTimeMs) {
        this.logger.warn(
          `Time budget exhausted after ${elapsed}ms and ${attempts} attempts: ${url}`,
        );
        break;
      }

      try {
        const data = await this.doFetch<T>(url, options);
        return { data, success: true, attempts };
      } catch (error: any) {
        lastError = error;

        const isRetryable = isRetryableError(error);

        // Don't retry non-retryable errors
        if (!isRetryable) {
          this.logger.debug(`Non-retryable error (${error.status || error.name}): ${url}`);
          return {
            data: null,
            success: false,
            attempts,
            error,
            isRetryable: false,
          };
        }

        // Don't retry if we've exhausted attempts
        if (attempt >= this.config.maxRetries) {
          this.logger.warn(`Max retries (${this.config.maxRetries}) exhausted: ${url}`);
          break;
        }

        // Calculate delay
        let delayMs = calculateBackoffDelay(attempt, this.config.baseDelayMs);

        // Respect Retry-After header for 429
        if (error.status === 429 && error.headers) {
          const retryAfterMs = parseRetryAfter(error.headers);
          if (retryAfterMs !== null) {
            delayMs = Math.max(delayMs, retryAfterMs);
          }
        }

        // Check if delay would exceed time budget
        const remainingTime = this.config.maxTotalTimeMs - (Date.now() - startTime);
        if (delayMs >= remainingTime) {
          this.logger.warn(
            `Delay ${delayMs}ms would exceed time budget (${remainingTime}ms remaining): ${url}`,
          );
          break;
        }

        this.logger.debug(
          `Retry ${attempt + 1}/${this.config.maxRetries} after ${delayMs}ms (${error.status || error.name}): ${url}`,
        );

        await sleep(delayMs);
      }
    }

    return {
      data: null,
      success: false,
      attempts,
      error: lastError,
      isRetryable: lastError ? isRetryableError(lastError) : undefined,
    };
  }

  /**
   * Performs a single fetch request with timeout.
   */
  private async doFetch<T>(url: string, options: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new HttpError(
          `${response.status} ${response.statusText}`,
          response.status,
          response.headers,
        );
      }

      return response.json();
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new HttpError('Request timeout', 408);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Convenience method for GET requests.
   */
  async get<T>(url: string, headers?: HeadersInit): Promise<FetchResult<T>> {
    return this.fetch<T>(url, { method: 'GET', headers });
  }

  /**
   * Convenience method for POST requests.
   */
  async post<T>(url: string, body: any, headers?: HeadersInit): Promise<FetchResult<T>> {
    return this.fetch<T>(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  }
}

/**
 * Shared instance with default configuration.
 */
export const resilientHttp = new ResilientHttpClient();
