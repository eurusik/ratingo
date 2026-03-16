import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

import { TmdbApiException } from '../../../../common/exceptions/external-api.exception';
import {
  HttpError,
  ResilientHttpClient,
  type RetryConfig,
} from '../../../../common/http/resilient-http.client';
import tmdbConfig from '../../../../config/tmdb.config';
import { type ITmdbResolverPort } from '../../domain/ports/tmdb-resolver.port';

/**
 * TMDB Find API response for IMDB ID lookup.
 */
interface TmdbFindResponse {
  movie_results: Array<{ id: number }>;
  tv_results: Array<{ id: number }>;
}

/**
 * TMDB-specific retry configuration for resolver calls.
 * Short timeout: these are lightweight single-endpoint calls.
 */
const RESOLVER_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxTotalTimeMs: 15000,
  timeoutMs: 8000,
};

/**
 * Infrastructure adapter implementing ITmdbResolverPort via TMDB HTTP API.
 *
 * Uses two TMDB endpoints:
 * - /find/{imdb_id}?external_source=imdb_id — resolves IMDB → TMDB ID + type
 * - /movie/{id} or /tv/{id} — checks existence by TMDB ID + type
 *
 * TMDB-only: no Trakt/OMDb/TVMaze calls. Safe for high-throughput backfill queue.
 */
@Injectable()
export class TmdbResolverAdapter implements ITmdbResolverPort {
  private readonly logger = new Logger(TmdbResolverAdapter.name);
  private readonly httpClient: ResilientHttpClient;

  constructor(
    @Inject(tmdbConfig.KEY)
    private readonly config: ConfigType<typeof tmdbConfig>,
  ) {
    this.httpClient = new ResilientHttpClient(RESOLVER_RETRY_CONFIG);
  }

  /**
   * Finds TMDB ID and type from an IMDB ID using the TMDB Find API.
   * Movie results take precedence over TV results when both exist.
   */
  async findByImdbId(imdbId: string): Promise<{ tmdbId: number; type: 'movie' | 'show' } | null> {
    try {
      const data = await this.fetch<TmdbFindResponse>(`/find/${imdbId}`, {
        external_source: 'imdb_id',
      });

      if (data.movie_results.length > 0 && data.movie_results[0].id) {
        return { tmdbId: data.movie_results[0].id, type: 'movie' };
      }

      if (data.tv_results.length > 0 && data.tv_results[0].id) {
        return { tmdbId: data.tv_results[0].id, type: 'show' };
      }

      this.logger.debug(`TMDB Find: no results for imdbId=${imdbId}`);
      return null;
    } catch (error) {
      if (error instanceof TmdbApiException && error.details?.statusCode === HttpStatus.NOT_FOUND) {
        return null;
      }
      this.logger.error(`TMDB findByImdbId error for ${imdbId}: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Checks whether a media item with the given TMDB ID and type exists.
   * Returns true on HTTP 200, false on HTTP 404.
   */
  async checkExists(tmdbId: number, type: 'movie' | 'show'): Promise<boolean> {
    const prefix = type === 'movie' ? 'movie' : 'tv';

    try {
      await this.fetch<{ id: number }>(`/${prefix}/${tmdbId}`, {});
      return true;
    } catch (error) {
      if (error instanceof TmdbApiException && error.details?.statusCode === HttpStatus.NOT_FOUND) {
        return false;
      }
      this.logger.error(
        `TMDB checkExists error for ${prefix}/${tmdbId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  private async fetch<T = unknown>(endpoint: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${this.config.apiUrl}${endpoint}`);
    url.searchParams.append('api_key', this.config.apiKey);

    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const result = await this.httpClient.get<T>(url.toString());

    if (!result.success) {
      const { error } = result;

      if (error instanceof HttpError) {
        if (error.status === HttpStatus.NOT_FOUND) {
          throw new TmdbApiException('Resource not found', HttpStatus.NOT_FOUND);
        }
        throw new TmdbApiException(error.message, error.status);
      }

      if (result.isRetryable) {
        throw new TmdbApiException(
          'Failed to communicate with TMDB after retries',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      throw new TmdbApiException(
        'Failed to communicate with TMDB',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return result.data;
  }
}
