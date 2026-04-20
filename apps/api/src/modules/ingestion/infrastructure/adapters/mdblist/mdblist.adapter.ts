import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

import { MediaType } from '../../../../../common/enums/media-type.enum';
import { MdblistApiException } from '../../../../../common/exceptions/external-api.exception';
import {
  ResilientHttpClient,
  type RetryConfig,
  HttpError,
} from '../../../../../common/http/resilient-http.client';
import mdblistConfig from '../../../../../config/mdblist.config';

/**
 * Single rating entry in MDBList response.
 */
interface MdblistRatingEntry {
  source: string;
  value: number | null;
  score: number | null;
  votes: number | null;
  url: string | number | null;
}

/**
 * MDBList API response shape for /tmdb/{movie|show}/{id} endpoint.
 */
interface MdblistResponse {
  title?: string;
  ids?: {
    imdb?: string | null;
    tmdb?: number | null;
    trakt?: number | null;
  };
  ratings?: MdblistRatingEntry[];
}

/**
 * Source identifiers in MDBList ratings array.
 */
const SOURCE = {
  TOMATOES: 'tomatoes', // Rotten Tomatoes — critics (Tomatometer)
  POPCORN: 'popcorn', // Rotten Tomatoes — audience (Popcornmeter)
} as const;

const TYPE_PATH: Record<MediaType, string> = {
  [MediaType.MOVIE]: 'movie',
  [MediaType.SHOW]: 'show',
};

/**
 * MDBList retry config — aggressive on latency, conservative on attempts.
 *
 * Free-tier budget is 1000 requests/day. On a 429 ("quota exhausted"),
 * retrying does not help until the daily reset at 00:00 UTC — so we cap retries
 * at 1 to avoid burning extra quota on transient overflow.
 *
 * maxRetries=1 still covers a single network blip.
 */
const MDBLIST_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 1,
  baseDelayMs: 500,
  maxTotalTimeMs: 15_000,
  timeoutMs: 10_000,
};

/**
 * Ratings returned by the MDBList adapter.
 *
 * MDBList also returns IMDb/Metacritic/Trakt values, but this adapter
 * scopes itself to Rotten Tomatoes fields only — other sources are already
 * owned by OMDb / Trakt adapters and mixing ownership causes churn.
 */
export interface MdblistRatings {
  /** Rotten Tomatoes critics score (Tomatometer) — 0-100 or null if unavailable */
  rottenTomatoesCritics: number | null;
  /** Rotten Tomatoes audience score (Popcornmeter) — 0-100 or null if unavailable */
  rottenTomatoesAudience: number | null;
}

/**
 * Adapter for MDBList API.
 *
 * Complements OMDb for Rotten Tomatoes coverage: OMDb frequently omits RT
 * values (especially for HBO/serial content), whereas MDBList mirrors
 * the public Rotten Tomatoes pages directly.
 *
 * Not a {@link MetadataProviderPort} — this is a rating-only adapter,
 * used by backfill pipelines rather than the main sync flow.
 */
@Injectable()
export class MdblistAdapter {
  private readonly logger = new Logger(MdblistAdapter.name);
  private readonly httpClient: ResilientHttpClient;

  constructor(
    @Inject(mdblistConfig.KEY)
    private readonly config: ConfigType<typeof mdblistConfig>,
  ) {
    this.httpClient = new ResilientHttpClient(MDBLIST_RETRY_CONFIG);
  }

  /**
   * Fetches Rotten Tomatoes ratings for a media item by TMDB ID.
   *
   * Best-effort: returns an object with null fields (rather than throwing)
   * when MDBList has no data for the requested title or the input is invalid.
   *
   * @param tmdbId - The TMDB numeric ID (must be a positive integer)
   * @param type - MediaType.MOVIE or MediaType.SHOW
   * @returns RT critics and audience scores (each 0-100 or null)
   */
  async getRottenTomatoesRatings(tmdbId: number, type: MediaType): Promise<MdblistRatings> {
    // Defensive runtime validation — BullMQ payloads are JSON and TypeScript
    // types do not survive serialisation, so a malformed payload (e.g. from
    // an older schema or a manual re-queue) could otherwise template a
    // weird string directly into the URL path.
    if (!Number.isInteger(tmdbId) || tmdbId <= 0 || tmdbId > 2_147_483_647) {
      this.logger.warn(`MDBList skipped: invalid tmdbId=${tmdbId}`);
      return { rottenTomatoesCritics: null, rottenTomatoesAudience: null };
    }
    if (!(type in TYPE_PATH)) {
      this.logger.warn(`MDBList skipped: invalid type=${type}`);
      return { rottenTomatoesCritics: null, rottenTomatoesAudience: null };
    }

    try {
      const data = await this.fetch<MdblistResponse>(tmdbId, type);

      const ratings = Array.isArray(data.ratings) ? data.ratings : [];
      return {
        rottenTomatoesCritics: this.extractScore(ratings, SOURCE.TOMATOES),
        rottenTomatoesAudience: this.extractScore(ratings, SOURCE.POPCORN),
      };
    } catch (error) {
      const status =
        error instanceof MdblistApiException
          ? (error.details as Record<string, unknown> | undefined)?.statusCode
          : 'unknown';
      this.logger.warn(`MDBList enrichment skipped for tmdbId=${tmdbId} (status=${status})`);
      return { rottenTomatoesCritics: null, rottenTomatoesAudience: null };
    }
  }

  /**
   * Internal request helper.
   */
  private async fetch<T>(tmdbId: number, type: MediaType): Promise<T> {
    if (!this.config.apiKey) {
      throw new MdblistApiException('API key is required');
    }

    const url = new URL(`${this.config.apiUrl}/tmdb/${TYPE_PATH[type]}/${tmdbId}`);
    url.searchParams.set('apikey', this.config.apiKey);

    const result = await this.httpClient.get<T>(url.toString());

    if (!result.success) {
      const { error } = result;

      if (error instanceof HttpError) {
        throw new MdblistApiException(error.message, error.status);
      }

      if (result.isRetryable) {
        throw new MdblistApiException(
          'Failed to communicate with MDBList after retries',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      throw new MdblistApiException(
        'Failed to communicate with MDBList',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return result.data as T;
  }

  /**
   * Extracts a 0-100 score for a given source from the ratings array.
   * MDBList exposes both `value` and `score` — they match for percentage
   * sources (RT), but `score` is safer as it's always normalised to 0-100.
   */
  private extractScore(ratings: MdblistRatingEntry[], source: string): number | null {
    const entry = ratings.find((r) => r.source === source);
    if (!entry) return null;

    const raw = entry.score ?? entry.value;
    if (raw == null) return null;

    const num = Number(raw);
    if (!Number.isFinite(num)) return null;

    // Clamp defensively — protects against upstream schema drift.
    return Math.max(0, Math.min(100, Math.round(num)));
  }
}
