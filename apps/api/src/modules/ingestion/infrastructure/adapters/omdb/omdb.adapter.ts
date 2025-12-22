import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import omdbConfig from '../../../../../config/omdb.config';
import { MediaType } from '../../../../../common/enums/media-type.enum';
import { OmdbApiException } from '../../../../../common/exceptions/external-api.exception';
import {
  ResilientHttpClient,
  RetryConfig,
  HttpError,
} from '../../../../../common/http/resilient-http.client';

/**
 * OMDb-specific retry configuration.
 * Best-effort enrichment - don't block too long.
 */
const OMDB_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxTotalTimeMs: 15000, // 15s total budget (best-effort)
  timeoutMs: 10000,
};

/**
 * Adapter for OMDb API.
 * Used primarily for fetching additional ratings (IMDb, Rotten Tomatoes, Metacritic).
 */
@Injectable()
export class OmdbAdapter {
  private readonly logger = new Logger(OmdbAdapter.name);
  private readonly httpClient: ResilientHttpClient;

  // OMDb specific constants
  private readonly NA_VALUE = 'N/A';
  private readonly SOURCE_ROTTEN_TOMATOES = 'Rotten Tomatoes';
  private readonly SOURCE_METACRITIC = 'Metacritic';

  // Mapping our types to OMDb types
  private readonly TYPE_MAPPING = {
    [MediaType.MOVIE]: 'movie',
    [MediaType.SHOW]: 'series',
  };

  constructor(
    @Inject(omdbConfig.KEY)
    private readonly config: ConfigType<typeof omdbConfig>,
  ) {
    this.httpClient = new ResilientHttpClient(OMDB_RETRY_CONFIG);
  }

  /**
   * Internal helper to make requests to OMDb with retry logic.
   *
   * @param {Record<string, string>} params - Query parameters
   * @returns {Promise<T>} Typed response
   */
  private async fetch<T>(params: Record<string, string>): Promise<T> {
    if (!this.config.apiKey) {
      throw new OmdbApiException('API key is required');
    }

    const url = new URL(this.config.apiUrl);
    url.searchParams.set('apikey', this.config.apiKey);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    const result = await this.httpClient.get<T>(url.toString());

    if (!result.success) {
      const error = result.error;

      if (error instanceof HttpError) {
        throw new OmdbApiException(error.message, error.status);
      }

      // Network/timeout errors after all retries
      if (result.isRetryable) {
        this.logger.warn(`OMDb request failed after ${result.attempts} attempts`);
        throw new OmdbApiException('Failed to communicate with OMDb after retries', 503);
      }

      throw new OmdbApiException('Failed to communicate with OMDb', 500);
    }

    return result.data as T;
  }

  /**
   * Fetches aggregated ratings (IMDb, Rotten Tomatoes, Metacritic) for a media item.
   *
   * @param {string} imdbId - The IMDb ID of the content (e.g. tt1234567)
   * @param {MediaType} type - Type of content (MOVIE or SHOW)
   * @returns {Promise<{ imdbRating: number | null; imdbVotes: number | null; rottenTomatoes: number | null; metacritic: number | null; metascore: number | null }>} Object containing available ratings
   */
  async getAggregatedRatings(
    imdbId: string,
    type: MediaType,
  ): Promise<{
    imdbRating: number | null;
    imdbVotes: number | null;
    rottenTomatoes: number | null;
    metacritic: number | null;
    metascore: number | null;
  }> {
    try {
      const omdbType = this.TYPE_MAPPING[type];
      const data = await this.fetch<any>({ i: imdbId, type: omdbType });

      const imdbRating =
        data.imdbRating && data.imdbRating !== this.NA_VALUE ? parseFloat(data.imdbRating) : null;

      const imdbVotes =
        data.imdbVotes && data.imdbVotes !== this.NA_VALUE
          ? parseInt(String(data.imdbVotes).replace(/,/g, ''), 10)
          : null;

      let rottenTomatoes: number | null = null;
      let metacritic: number | null = null;

      if (Array.isArray(data.Ratings)) {
        const rt = data.Ratings.find((r: any) => r.Source === this.SOURCE_ROTTEN_TOMATOES);
        if (rt?.Value) {
          const m = rt.Value.match(/(\d+)%/);
          if (m) rottenTomatoes = parseInt(m[1], 10);
        }

        const mc = data.Ratings.find((r: any) => r.Source === this.SOURCE_METACRITIC);
        if (mc?.Value) {
          const m = mc.Value.match(/(\d+)/);
          if (m) metacritic = parseInt(m[1], 10);
        }
      }

      const metascore =
        data.Metascore && data.Metascore !== this.NA_VALUE ? parseInt(data.Metascore, 10) : null;

      return { imdbRating, imdbVotes, rottenTomatoes, metacritic, metascore };
    } catch (error) {
      // Best-effort: log warning but don't fail the job
      const status =
        error instanceof OmdbApiException ? (error.details as any)?.statusCode : 'unknown';
      this.logger.warn(`OMDb enrichment skipped for ${imdbId} (status=${status})`);
      return {
        imdbRating: null,
        imdbVotes: null,
        rottenTomatoes: null,
        metacritic: null,
        metascore: null,
      };
    }
  }
}
