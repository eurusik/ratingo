import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

import {
  DEFAULT_REGION,
  DEFAULT_LANGUAGE,
  CATALOG_DEFAULT_NEW_RELEASE_DAYS,
  MS_PER_DAY,
} from '../../common/constants';
import { MediaType } from '../../common/enums/media-type.enum';
import { TmdbApiException } from '../../common/exceptions/external-api.exception';
import {
  ResilientHttpClient,
  type RetryConfig,
  HttpError,
} from '../../common/http/resilient-http.client';
import tmdbConfig from '../../config/tmdb.config';
import {
  type MetadataProviderPort,
  type NormalizedMedia,
  type NormalizedEpisode,
} from '../ingestion/public';

import { TmdbMapper } from './mappers/tmdb.mapper';
import type { TmdbMediaResponse, TmdbSeasonDetailResponse } from './types/tmdb-api.types';

/**
 * TMDB-specific retry configuration.
 * More aggressive retries since TMDB is critical for sync.
 */
const TMDB_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxTotalTimeMs: 45000, // 45s total budget
  timeoutMs: 15000,
};

/** Safety limit to prevent infinite loops when paginating */
const MAX_PAGES = 10;

/**
 * TMDB API response for paginated results.
 */
interface TmdbPaginatedResponse {
  results: TmdbResultItem[];
  total_pages: number;
  total_results: number;
  page: number;
}

/**
 * TMDB result item from paginated endpoints.
 */
interface TmdbResultItem {
  id: number;
  media_type?: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  vote_average?: number;
}

/**
 * Search result item returned by searchMulti.
 */
export interface TmdbSearchResult {
  externalIds: { tmdbId: number };
  type: MediaType;
  title: string;
  originalTitle: string | null;
  releaseDate: string | null;
  posterPath: string | null;
  rating: number;
}

/**
 * Implementation of MetadataProvider for The Movie Database (TMDB) API v3.
 * Handles fetching, error handling (404s), and mapping to domain models.
 */
@Injectable()
export class TmdbAdapter implements MetadataProviderPort {
  public readonly providerName = 'tmdb';
  private readonly logger = new Logger(TmdbAdapter.name);
  private readonly DEFAULT_LANG = DEFAULT_LANGUAGE;
  private readonly httpClient: ResilientHttpClient;

  constructor(
    @Inject(tmdbConfig.KEY)
    private readonly config: ConfigType<typeof tmdbConfig>,
  ) {
    this.httpClient = new ResilientHttpClient(TMDB_RETRY_CONFIG);
  }

  /**
   * Fetches full movie details including credits and videos in a single request.
   * Returns null if the resource is not found (404).
   */
  public async getMovie(tmdbId: number): Promise<NormalizedMedia | null> {
    try {
      const data = await this.fetch<TmdbMediaResponse>(`/movie/${tmdbId}`, {
        append_to_response: 'credits,videos,release_dates,watch/providers',
        include_video_language: 'uk,en',
      });
      const result = TmdbMapper.toDomain(data, MediaType.MOVIE);
      // Fallback: if no localized data, create minimal object for import
      if (!result && data?.id) {
        const releaseDateStr = 'release_date' in data ? data.release_date : null;
        const movieData = data as TmdbMediaResponse & {
          production_countries?: Array<{ iso_3166_1: string }>;
        };
        return {
          externalIds: {
            tmdbId: data.id,
            imdbId: ('imdb_id' in data ? data.imdb_id : null) || null,
          },
          type: MediaType.MOVIE,
          title:
            ('title' in data ? data.title : '') ||
            ('original_title' in data ? data.original_title : '') ||
            `TMDB #${tmdbId}`,
          originalTitle: ('original_title' in data ? data.original_title : null) || null,
          overview: data.overview || null,
          slug: '',
          posterPath: data.poster_path || null,
          backdropPath: data.backdrop_path || null,
          rating: data.vote_average || 0,
          voteCount: data.vote_count || 0,
          popularity: data.popularity || 0,
          releaseDate: releaseDateStr ? new Date(releaseDateStr) : null,
          genres: [],
          videos: [],
          credits: { cast: [], crew: [] },
          watchProvidersRaw: {},
          isAdult: data.adult || false,
          // Preserve origin metadata even in fallback path
          originCountries: movieData.production_countries?.map((c) => c.iso_3166_1) || null,
          originalLanguage: data.original_language || null,
        } as NormalizedMedia;
      }
      return result;
    } catch (error) {
      if (error instanceof TmdbApiException && error.details?.statusCode === HttpStatus.NOT_FOUND) {
        this.logger.warn(`TMDB movie ${tmdbId} not found (404)`);
        return null;
      }
      this.logger.error(`TMDB getMovie error for ${tmdbId}:`, error);
      throw error;
    }
  }

  /**
   * Fetches full show details including aggregate credits and videos.
   * Returns null if the resource is not found (404).
   */
  public async getShow(tmdbId: number): Promise<NormalizedMedia | null> {
    try {
      const data = await this.fetch<TmdbMediaResponse>(`/tv/${tmdbId}`, {
        append_to_response: 'external_ids,aggregate_credits,videos,content_ratings,watch/providers',
        include_video_language: 'uk,en',
      });
      const result = TmdbMapper.toDomain(data, MediaType.SHOW);
      // Fallback: if no localized data, create minimal object for import
      if (!result && data?.id) {
        const releaseDateStr = 'first_air_date' in data ? data.first_air_date : null;
        const showData = data as TmdbMediaResponse & { origin_country?: string[] };
        return {
          externalIds: { tmdbId: data.id, imdbId: data.external_ids?.imdb_id || null },
          type: MediaType.SHOW,
          title:
            ('name' in data ? data.name : '') ||
            ('original_name' in data ? data.original_name : '') ||
            `TMDB #${tmdbId}`,
          originalTitle: ('original_name' in data ? data.original_name : null) || null,
          overview: data.overview || null,
          slug: '',
          posterPath: data.poster_path || null,
          backdropPath: data.backdrop_path || null,
          rating: data.vote_average || 0,
          voteCount: data.vote_count || 0,
          popularity: data.popularity || 0,
          releaseDate: releaseDateStr ? new Date(releaseDateStr) : null,
          genres: [],
          videos: [],
          credits: { cast: [], crew: [] },
          watchProvidersRaw: {},
          isAdult: data.adult || false,
          // Preserve origin metadata even in fallback path
          originCountries: showData.origin_country || null,
          originalLanguage: data.original_language || null,
        } as NormalizedMedia;
      }
      return result;
    } catch (error) {
      if (error instanceof TmdbApiException && error.details?.statusCode === HttpStatus.NOT_FOUND) {
        this.logger.warn(`TMDB show ${tmdbId} not found (404)`);
        return null;
      }
      this.logger.error(`TMDB getShow error for ${tmdbId}:`, error);
      throw error;
    }
  }

  /**
   * Fetches trending media for the day.
   * Supports filtering by media type (movie/show).
   */
  public async getTrending(
    page = 1,
    type?: MediaType,
  ): Promise<{ tmdbId: number; type: MediaType }[]> {
    let endpoint = '/trending/all/day';

    if (type) {
      const tmdbType = type === MediaType.MOVIE ? 'movie' : 'tv';
      endpoint = `/trending/${tmdbType}/day`;
    }

    const data = await this.fetch<TmdbPaginatedResponse>(endpoint, { page: page.toString() });

    return (data.results || [])
      .filter((item) => item.media_type !== 'person')
      .map((item) => ({
        tmdbId: item.id,
        // If specific type endpoint used, media_type might be missing in result, so use the requested type
        type: type || (item.media_type === 'movie' ? MediaType.MOVIE : MediaType.SHOW),
      }));
  }

  /**
   * Retrieves IDs of movies currently playing in theaters.
   * Uses TMDB's now_playing endpoint which handles the "in theaters" logic.
   *
   * @param {string} region - ISO 3166-1 country code
   * @returns {Promise<number[]>} Array of TMDB movie IDs
   */
  public async getNowPlayingIds(region = DEFAULT_REGION): Promise<number[]> {
    const ids: number[] = [];
    let pagesFetched = 0;
    let totalPages = 0;

    // Fetch all pages (with safety limit to prevent infinite loops)
    for (let page = 1; page <= MAX_PAGES; page++) {
      const data = await this.fetch<TmdbPaginatedResponse>('/movie/now_playing', {
        region,
        page: page.toString(),
      });

      const pageIds = (data.results || []).map((m) => m.id);
      ids.push(...pageIds);

      pagesFetched = page;
      totalPages = data.total_pages;

      // Stop if we've reached the last page
      if (page >= data.total_pages) break;
    }

    this.logger.log(
      `now_playing region=${region} pagesFetched=${pagesFetched} totalPages=${totalPages} idsFound=${ids.length}`,
    );

    return ids;
  }

  /**
   * Retrieves IDs of newly released movies (theatrical).
   * Uses discover endpoint with release date filters.
   *
   * @param {number} daysBack - How far back to look for releases
   * @param {string} region - ISO 3166-1 country code
   * @returns {Promise<number[]>} Array of TMDB movie IDs
   */
  public async getNewReleaseIds(
    daysBack = CATALOG_DEFAULT_NEW_RELEASE_DAYS,
    region = DEFAULT_REGION,
  ): Promise<number[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - daysBack * MS_PER_DAY);
    const ids: number[] = [];
    let pagesFetched = 0;
    let totalPages = 0;

    // Fetch all pages (with safety limit)
    for (let page = 1; page <= MAX_PAGES; page++) {
      const data = await this.fetch<TmdbPaginatedResponse>('/discover/movie', {
        region,
        sort_by: 'primary_release_date.desc',
        'primary_release_date.lte': now.toISOString().split('T')[0],
        'primary_release_date.gte': cutoff.toISOString().split('T')[0],
        with_release_type: '3', // Theatrical
        page: page.toString(),
      });

      const pageIds = (data.results || []).map((m) => m.id);
      ids.push(...pageIds);

      pagesFetched = page;
      totalPages = data.total_pages;

      // Stop if we've reached the last page
      if (page >= data.total_pages) break;
    }

    if (totalPages > MAX_PAGES) {
      this.logger.warn(
        `New releases limit reached: fetched ${MAX_PAGES} pages, but total is ${totalPages}. Some releases may be missed.`,
      );
    }

    this.logger.log(
      `new_releases region=${region} daysBack=${daysBack} pagesFetched=${pagesFetched} totalPages=${totalPages} idsFound=${ids.length}`,
    );

    return ids;
  }

  /**
   * Fetches episodes for a specific season from TMDB.
   * Used as fallback when TVMaze has no data for the show.
   * Returns empty array on 404.
   */
  public async getSeasonEpisodes(
    tmdbId: number,
    seasonNumber: number,
  ): Promise<NormalizedEpisode[]> {
    try {
      const data = await this.fetch<TmdbSeasonDetailResponse>(
        `/tv/${tmdbId}/season/${seasonNumber}`,
      );

      if (!Array.isArray(data.episodes)) return [];

      return data.episodes.map((ep) => ({
        tmdbId: ep.id,
        number: ep.episode_number,
        title: ep.name,
        overview: ep.overview || null,
        airDate: ep.air_date ? new Date(ep.air_date) : null,
        runtime: ep.runtime ?? null,
        stillPath: ep.still_path || null,
        rating: ep.vote_average > 0 ? ep.vote_average : null,
      }));
    } catch (error) {
      if (error instanceof TmdbApiException && error.details?.statusCode === HttpStatus.NOT_FOUND) {
        return [];
      }
      this.logger.warn(
        `TMDB getSeasonEpisodes error for show ${tmdbId} S${seasonNumber}: ${(error as Error).message}`,
      );
      return [];
    }
  }

  /**
   * Performs a multi-search (movies & shows).
   *
   * @param {string} query - Search string
   * @param {number} page - Page number
   * @returns {Promise<TmdbSearchResult[]>} Search results
   */
  public async searchMulti(query: string, page = 1): Promise<TmdbSearchResult[]> {
    // TMDB search works with any language query but returns localized titles
    // when language param is set. We keep uk-UA to get Ukrainian titles.
    const data = await this.fetch<TmdbPaginatedResponse>('/search/multi', {
      query,
      page: page.toString(),
      include_adult: 'false',
    });

    return (data.results || [])
      .filter((item) => item.media_type === 'movie' || item.media_type === 'tv')
      .map((item) => ({
        externalIds: { tmdbId: item.id },
        type: item.media_type === 'movie' ? MediaType.MOVIE : MediaType.SHOW,
        title: item.title || item.name || '',
        originalTitle: item.original_title || item.original_name || null,
        releaseDate: item.release_date || item.first_air_date || null,
        posterPath: item.poster_path || null,
        rating: item.vote_average || 0,
      }));
  }

  /**
   * Helper method to perform fetch requests with retry logic.
   * Uses ResilientHttpClient for automatic retries with exponential backoff.
   */
  private async fetch<T = unknown>(
    endpoint: string,
    params: Record<string, string> = {},
    options: { skipLanguage?: boolean } = {},
  ): Promise<T> {
    const url = new URL(`${this.config.apiUrl}${endpoint}`);

    // Default params
    url.searchParams.append('api_key', this.config.apiKey);
    if (!options.skipLanguage) {
      url.searchParams.append('language', this.DEFAULT_LANG);
    }

    // Custom params
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

      // Network/timeout errors after all retries
      if (result.isRetryable) {
        this.logger.error(`TMDB request failed after ${result.attempts} attempts: ${endpoint}`);
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
