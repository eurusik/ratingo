import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { IMetadataProvider } from '../ingestion/domain/interfaces/metadata-provider.interface';
import { NormalizedMedia } from '../ingestion/domain/models/normalized-media.model';
import { TmdbMapper } from './mappers/tmdb.mapper';
import tmdbConfig from '../../config/tmdb.config';
import { MediaType } from '../../common/enums/media-type.enum';
import { TmdbApiException } from '../../common/exceptions/external-api.exception';
import { DEFAULT_REGION, DEFAULT_LANGUAGE } from '../../common/constants';

/**
 * Implementation of MetadataProvider for The Movie Database (TMDB) API v3.
 * Handles fetching, error handling (404s), and mapping to domain models.
 */
@Injectable()
export class TmdbAdapter implements IMetadataProvider {
  public readonly providerName = 'tmdb';
  private readonly logger = new Logger(TmdbAdapter.name);
  private readonly DEFAULT_LANG = DEFAULT_LANGUAGE;
  private readonly MAX_PAGES = 10; // Safety limit to prevent infinite loops

  constructor(
    @Inject(tmdbConfig.KEY)
    private readonly config: ConfigType<typeof tmdbConfig>,
  ) {}

  /**
   * Fetches full movie details including credits and videos in a single request.
   * Returns null if the resource is not found (404).
   */
  public async getMovie(tmdbId: number): Promise<NormalizedMedia | null> {
    try {
      const data = await this.fetch(`/movie/${tmdbId}`, {
        append_to_response: 'credits,videos,release_dates,watch/providers',
        include_video_language: 'uk,en',
      });
      const result = TmdbMapper.toDomain(data, MediaType.MOVIE);
      // Fallback: if no localized data, create minimal object for import
      if (!result && data?.id) {
        return {
          externalIds: { tmdbId: data.id, imdbId: data.imdb_id || null },
          type: MediaType.MOVIE,
          title: data.title || data.original_title || `TMDB #${tmdbId}`,
          originalTitle: data.original_title || null,
          overview: data.overview || null,
          slug: '',
          posterPath: data.poster_path || null,
          backdropPath: data.backdrop_path || null,
          rating: data.vote_average || 0,
          voteCount: data.vote_count || 0,
          popularity: data.popularity || 0,
          releaseDate: data.release_date || null,
          genres: [],
          videos: [],
          credits: { cast: [], crew: [] },
          watchProviders: {},
        } as NormalizedMedia;
      }
      return result;
    } catch (error) {
      if (error instanceof TmdbApiException && error.details?.statusCode === 404) {
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
      const data = await this.fetch(`/tv/${tmdbId}`, {
        append_to_response: 'aggregate_credits,videos,content_ratings,watch/providers',
        include_video_language: 'uk,en',
      });
      const result = TmdbMapper.toDomain(data, MediaType.SHOW);
      // Fallback: if no localized data, create minimal object for import
      if (!result && data?.id) {
        return {
          externalIds: { tmdbId: data.id, imdbId: data.external_ids?.imdb_id || null },
          type: MediaType.SHOW,
          title: data.name || data.original_name || `TMDB #${tmdbId}`,
          originalTitle: data.original_name || null,
          overview: data.overview || null,
          slug: '',
          posterPath: data.poster_path || null,
          backdropPath: data.backdrop_path || null,
          rating: data.vote_average || 0,
          voteCount: data.vote_count || 0,
          popularity: data.popularity || 0,
          releaseDate: data.first_air_date || null,
          genres: [],
          videos: [],
          credits: { cast: [], crew: [] },
          watchProviders: {},
        } as NormalizedMedia;
      }
      return result;
    } catch (error) {
      if (error instanceof TmdbApiException && error.details?.statusCode === 404) {
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

    const data = await this.fetch(endpoint, { page: page.toString() });

    return (data.results || [])
      .filter((item: any) => item.media_type !== 'person')
      .map((item: any) => ({
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

    // Fetch all pages (with safety limit to prevent infinite loops)
    for (let page = 1; page <= this.MAX_PAGES; page++) {
      const data = await this.fetch('/movie/now_playing', {
        region,
        page: page.toString(),
      });

      const pageIds = (data.results || []).map((m: any) => m.id);
      ids.push(...pageIds);

      // Stop if we've reached the last page
      if (page >= data.total_pages) break;
    }

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
  public async getNewReleaseIds(daysBack = 30, region = DEFAULT_REGION): Promise<number[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
    const ids: number[] = [];

    // Fetch all pages (with safety limit)
    for (let page = 1; page <= this.MAX_PAGES; page++) {
      const data = await this.fetch('/discover/movie', {
        region,
        sort_by: 'primary_release_date.desc',
        'primary_release_date.lte': now.toISOString().split('T')[0],
        'primary_release_date.gte': cutoff.toISOString().split('T')[0],
        with_release_type: '3', // Theatrical
        page: page.toString(),
      });

      const pageIds = (data.results || []).map((m: any) => m.id);
      ids.push(...pageIds);

      // Stop if we've reached the last page
      if (page >= data.total_pages) break;
    }

    return ids;
  }

  /**
   * Performs a multi-search (movies & shows).
   *
   * @param {string} query - Search string
   * @param {number} page - Page number
   * @returns {Promise<any[]>} Search results
   */
  public async searchMulti(query: string, page = 1): Promise<any[]> {
    // TMDB search works with any language query but returns localized titles
    // when language param is set. We keep uk-UA to get Ukrainian titles.
    const data = await this.fetch('/search/multi', {
      query,
      page: page.toString(),
      include_adult: 'false',
    });

    return (data.results || [])
      .filter((item: any) => item.media_type === 'movie' || item.media_type === 'tv')
      .map((item: any) => ({
        externalIds: { tmdbId: item.id },
        type: item.media_type === 'movie' ? MediaType.MOVIE : MediaType.SHOW,
        title: item.title || item.name,
        originalTitle: item.original_title || item.original_name,
        releaseDate: item.release_date || item.first_air_date,
        posterPath: item.poster_path,
        rating: item.vote_average,
      }));
  }

  /**
   * Helper method to perform fetch requests with default headers and params.
   */
  private async fetch(
    endpoint: string,
    params: Record<string, string> = {},
    options: { skipLanguage?: boolean } = {},
  ): Promise<any> {
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

    try {
      const res = await fetch(url.toString());

      if (!res.ok) {
        if (res.status === 404) {
          throw new TmdbApiException('Resource not found', 404);
        }
        throw new TmdbApiException(`${res.status} ${res.statusText}`, res.status);
      }

      return await res.json();
    } catch (error) {
      if (error instanceof TmdbApiException) throw error;
      this.logger.error(`TMDB Request Failed: ${error.message}`, error.stack);
      throw new TmdbApiException('Failed to communicate with TMDB', 500);
    }
  }
}
