import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

import { TraktApiException } from '../../../../../common/exceptions/external-api.exception';
import {
  ResilientHttpClient,
  type RetryConfig,
  HttpError,
  parseRetryAfter,
} from '../../../../../common/http/resilient-http.client';
import traktConfig from '../../../../../config/trakt.config';

/**
 * Trakt-specific retry configuration.
 * Conservative retries due to strict rate limits.
 */
const TRAKT_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 2,
  baseDelayMs: 2000, // Longer base delay for Trakt
  maxTotalTimeMs: 120000, // 2 minutes for regular operations
  timeoutMs: 15000,
};

/**
 * Bulk operations retry config (backfill, mass sync).
 * Longer time budget to handle Retry-After: 300s from Trakt.
 */
const TRAKT_BULK_RETRY_CONFIG: Partial<RetryConfig> = {
  ...TRAKT_RETRY_CONFIG,
  maxTotalTimeMs: 600000, // 10 minutes for bulk operations
};

// Jitter for Retry-After to avoid thundering herd
const RETRY_AFTER_JITTER_MS = 1000;

// Rate limiter configuration
// Trakt limit: 1000 req / 5 min = 3.33 req/s
// We use 2 req/s to stay safely under the limit with margin for retries.
// With concurrency=2 and 4 calls per job = 8 concurrent requests max.
const RATE_LIMITER_MAX_TOKENS = 2;
const RATE_LIMITER_REFILL_INTERVAL_MS = 500; // 2 req/s (1 token every 500ms)
const RATE_LIMITER_MAX_QUEUE_SIZE = 250;
const RATE_LIMITER_ACQUIRE_TIMEOUT_MS = 120000; // 2 minutes

/**
 * Token bucket rate limiter with timeout, max queue size, and 429 freeze support.
 * Shared across all Trakt adapter instances within a single Node process.
 *
 * Note: If running multiple processes (PM2 cluster, K8s pods), each process
 * has its own limiter. Reduce maxTokens accordingly or use Redis-based limiter.
 */
class RateLimiter {
  private tokens: number;
  private queue: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];
  // Stored for potential cleanup in the future (e.g., graceful shutdown)
  private _intervalId: NodeJS.Timeout | null = null;
  // Freeze until this timestamp (for 429 handling)
  private pauseUntil = 0;
  private readonly logger = new Logger('TraktRateLimiter');

  constructor(
    private readonly maxTokens: number = RATE_LIMITER_MAX_TOKENS,
    private readonly refillIntervalMs: number = RATE_LIMITER_REFILL_INTERVAL_MS,
    private readonly maxQueueSize: number = RATE_LIMITER_MAX_QUEUE_SIZE,
    private readonly acquireTimeoutMs: number = RATE_LIMITER_ACQUIRE_TIMEOUT_MS,
  ) {
    // Start with empty bucket to prevent initial burst on API startup.
    // Tokens will refill gradually, spreading out the first requests.
    this.tokens = 0;
    this.startRefillInterval();
  }

  private startRefillInterval(): void {
    // Refill tokens at regular intervals for smoother rate limiting
    this._intervalId = setInterval(() => {
      // Don't refill while paused
      if (this.isPaused()) return;

      if (this.tokens < this.maxTokens) {
        this.tokens++;
        this.processQueue();
      }
    }, this.refillIntervalMs);

    // Allow Node process (and Jest) to exit even if this interval is still active.
    // The limiter is best-effort; keeping the process alive is not desired.
    if (this._intervalId && typeof this._intervalId.unref === 'function') {
      this._intervalId.unref();
    }
  }

  private processQueue(): void {
    // Don't process while paused
    if (this.isPaused()) return;

    while (this.queue.length > 0 && this.tokens > 0) {
      this.tokens--;
      const { resolve } = this.queue.shift()!;
      resolve();
    }
  }

  /**
   * Checks if the limiter is currently paused (due to 429).
   */
  private isPaused(): boolean {
    return Date.now() < this.pauseUntil;
  }

  /**
   * Returns remaining pause time in ms, or 0 if not paused.
   */
  private getRemainingPauseMs(): number {
    return Math.max(0, this.pauseUntil - Date.now());
  }

  /**
   * Pauses the limiter until the specified time.
   * Used when we receive a 429 with Retry-After header.
   *
   * @param durationMs - How long to pause in milliseconds
   */
  pause(durationMs: number): void {
    const newPauseUntil = Date.now() + durationMs;
    // Only extend pause, never shorten
    if (newPauseUntil > this.pauseUntil) {
      this.pauseUntil = newPauseUntil;
      this.logger.warn(`Rate limiter paused for ${Math.round(durationMs / 1000)}s due to 429`);
    }
  }

  /**
   * Stops the refill interval. Call this for graceful shutdown.
   */
  destroy(): void {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  async acquire(): Promise<void> {
    // Wait for any pause to end (loop in case pause is extended while waiting)
    // This prevents race condition where pause is extended by another request
    // while we're sleeping
    while (true) {
      const remainingPauseMs = this.getRemainingPauseMs();
      if (remainingPauseMs <= 0) break;

      this.logger.debug(`Waiting ${Math.round(remainingPauseMs / 1000)}s for rate limit pause`);
      await new Promise((resolve) => setTimeout(resolve, remainingPauseMs));
    }

    // Fast path: token available
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    // Check queue size limit
    if (this.queue.length >= this.maxQueueSize) {
      throw new TraktApiException(
        `Rate limiter queue full (${this.maxQueueSize}). Too many concurrent requests.`,
      );
    }

    // Wait in queue with timeout
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // Remove from queue on timeout
        const idx = this.queue.findIndex((item) => item.resolve === resolve);
        if (idx !== -1) {
          this.queue.splice(idx, 1);
        }
        reject(new Error(`Rate limiter timeout after ${this.acquireTimeoutMs}ms`));
      }, this.acquireTimeoutMs);

      this.queue.push({
        resolve: () => {
          clearTimeout(timeoutId);
          resolve();
        },
        reject,
      });
    });
  }
}

// Shared limiter: ~3 requests per second (1 token every 333ms, max 3 tokens)
// Max queue: 100 requests, timeout: 30 seconds
const sharedLimiter = new RateLimiter(
  RATE_LIMITER_MAX_TOKENS,
  RATE_LIMITER_REFILL_INTERVAL_MS,
  RATE_LIMITER_MAX_QUEUE_SIZE,
  RATE_LIMITER_ACQUIRE_TIMEOUT_MS,
);

/**
 * Cleanup function for tests - stops the rate limiter interval.
 * Call this in afterAll() to prevent Jest from hanging.
 */
export function destroyTraktRateLimiter(): void {
  sharedLimiter.destroy();
}

/**
 * Options for fetch method.
 */
interface TraktFetchOptions extends RequestInit {
  /** Use bulk config with 10min time budget (for backfill/mass sync) */
  bulk?: boolean;
}

@Injectable()
export class BaseTraktHttp {
  protected readonly logger = new Logger(BaseTraktHttp.name);
  private readonly httpClient: ResilientHttpClient;
  private readonly bulkHttpClient: ResilientHttpClient;

  constructor(
    @Inject(traktConfig.KEY)
    private readonly config: ConfigType<typeof traktConfig>,
  ) {
    if (!this.config.clientId) {
      throw new TraktApiException('Client ID is not configured');
    }
    this.httpClient = new ResilientHttpClient(TRAKT_RETRY_CONFIG);
    this.bulkHttpClient = new ResilientHttpClient(TRAKT_BULK_RETRY_CONFIG);
  }

  /**
   * Generic fetch wrapper with automatic rate limit handling and retry logic.
   * Uses shared rate limiter to ensure max 3 req/s across all Trakt calls.
   * Freezes limiter on 429 to respect Retry-After header globally.
   *
   * @param endpoint - API endpoint starting with slash (e.g., '/shows/trending')
   * @param options - Fetch options including `bulk` flag for longer time budget
   * @returns Parsed JSON response
   * @throws TraktApiException if response is not OK and not retriable
   */
  protected async fetch<T>(endpoint: string, options: TraktFetchOptions = {}): Promise<T> {
    const { bulk, ...fetchOptions } = options;

    // Acquire token from shared limiter before making request
    await sharedLimiter.acquire();

    const url = `${this.config.apiUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': this.config.clientId!,
      'User-Agent': this.config.userAgent,
      ...fetchOptions.headers,
    };

    // Use bulk client for backfill/mass sync operations
    const client = bulk ? this.bulkHttpClient : this.httpClient;
    const result = await client.fetch<T>(url, { ...fetchOptions, headers });

    if (!result.success) {
      const { error } = result;

      if (error instanceof HttpError) {
        // On 429, freeze the shared limiter for ALL requests
        if (error.status === HttpStatus.TOO_MANY_REQUESTS) {
          this.freezeLimiterOn429(error);
          this.logger.warn(
            `Trakt rate limit exceeded after ${result.attempts} attempts: ${endpoint}`,
          );
        }
        throw new TraktApiException(error.message, error.status);
      }

      // Network/timeout errors after all retries
      if (result.isRetryable) {
        this.logger.error(`Trakt request failed after ${result.attempts} attempts: ${endpoint}`);
        throw new TraktApiException(
          'Failed to communicate with Trakt after retries',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      throw new TraktApiException(
        'Failed to communicate with Trakt',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return result.data as T;
  }

  /**
   * Fetch with bulk time budget (10 minutes).
   * Use for backfill and mass sync operations.
   *
   * @param endpoint - API endpoint
   * @param options - Fetch options
   * @returns Parsed JSON response
   */
  protected fetchBulk<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    return this.fetch<T>(endpoint, { ...options, bulk: true });
  }

  /**
   * Freezes the shared rate limiter based on 429 Retry-After header.
   * This prevents other requests from hitting the rate limit.
   */
  private freezeLimiterOn429(error: HttpError): void {
    if (!error.headers) return;

    const retryAfterMs = parseRetryAfter(error.headers);
    if (retryAfterMs !== null && retryAfterMs > 0) {
      // Add jitter to avoid thundering herd when limit expires
      const pauseMs = retryAfterMs + Math.floor(Math.random() * RETRY_AFTER_JITTER_MS);
      sharedLimiter.pause(pauseMs);
    }
  }
}
