import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import traktConfig from '../../../../../config/trakt.config';
import { TraktApiException } from '../../../../../common/exceptions/external-api.exception';
import {
  ResilientHttpClient,
  RetryConfig,
  HttpError,
  parseRetryAfter,
} from '../../../../../common/http/resilient-http.client';

/**
 * Trakt-specific retry configuration.
 * Conservative retries due to strict rate limits.
 */
const TRAKT_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 2,
  baseDelayMs: 2000, // Longer base delay for Trakt
  maxTotalTimeMs: 30000,
  timeoutMs: 15000,
};

/**
 * Token bucket rate limiter with timeout and max queue size.
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

  constructor(
    private readonly maxTokens: number = 3,
    private readonly refillIntervalMs: number = 333, // Refill 1 token every 333ms = ~3/sec (smoother)
    private readonly maxQueueSize: number = 100,
    private readonly acquireTimeoutMs: number = 30000, // 30 seconds
  ) {
    this.tokens = maxTokens;
    this.startRefillInterval();
  }

  private startRefillInterval(): void {
    // Refill tokens at regular intervals for smoother rate limiting
    this._intervalId = setInterval(() => {
      if (this.tokens < this.maxTokens) {
        this.tokens++;
        this.processQueue();
      }
    }, this.refillIntervalMs);

    // Allow Node process (and Jest) to exit even if this interval is still active.
    // The limiter is best-effort; keeping the process alive is not desired.
    if (this._intervalId && typeof (this._intervalId as any).unref === 'function') {
      (this._intervalId as any).unref();
    }
  }

  private processQueue(): void {
    while (this.queue.length > 0 && this.tokens > 0) {
      this.tokens--;
      const { resolve } = this.queue.shift()!;
      resolve();
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
    // Fast path: token available
    if (this.tokens > 0) {
      this.tokens--;
      return;
    }

    // Check queue size limit
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error(
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
const sharedLimiter = new RateLimiter(3, 333, 100, 30000);

/**
 * Cleanup function for tests - stops the rate limiter interval.
 * Call this in afterAll() to prevent Jest from hanging.
 */
export function destroyTraktRateLimiter(): void {
  sharedLimiter.destroy();
}

@Injectable()
export class BaseTraktHttp {
  protected readonly logger = new Logger(BaseTraktHttp.name);
  private readonly httpClient: ResilientHttpClient;

  constructor(
    @Inject(traktConfig.KEY)
    private readonly config: ConfigType<typeof traktConfig>,
  ) {
    if (!this.config.clientId) {
      throw new TraktApiException('Client ID is not configured');
    }
    this.httpClient = new ResilientHttpClient(TRAKT_RETRY_CONFIG);
  }

  /**
   * Generic fetch wrapper with automatic rate limit handling and retry logic.
   * Uses shared rate limiter to ensure max 3 req/s across all Trakt calls.
   *
   * @param {string} endpoint - API endpoint starting with slash (e.g., '/shows/trending')
   * @param {RequestInit} options - Standard fetch options
   * @returns {Promise<T>} Parsed JSON response
   * @throws TraktApiException if response is not OK and not retriable
   */
  protected async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Acquire token from shared limiter before making request
    await sharedLimiter.acquire();

    const url = `${this.config.apiUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': this.config.clientId!,
      'User-Agent': this.config.userAgent,
      ...options.headers,
    };

    const result = await this.httpClient.fetch<T>(url, { ...options, headers });

    if (!result.success) {
      const error = result.error;

      if (error instanceof HttpError) {
        // Special handling for 429 - already retried with Retry-After
        if (error.status === 429) {
          this.logger.warn(
            `Trakt rate limit exceeded after ${result.attempts} attempts: ${endpoint}`,
          );
        }
        throw new TraktApiException(error.message, error.status);
      }

      // Network/timeout errors after all retries
      if (result.isRetryable) {
        this.logger.error(`Trakt request failed after ${result.attempts} attempts: ${endpoint}`);
        throw new TraktApiException('Failed to communicate with Trakt after retries', 503);
      }

      throw new TraktApiException('Failed to communicate with Trakt', 500);
    }

    return result.data as T;
  }
}
