/**
 * Typed catalog API client.
 *
 * Provides type-safe methods for catalog endpoints using api-contract types.
 *
 * @example
 * import { catalogApi } from '@/core/api/catalog';
 * const shows = await catalogApi.getTrendingShows({ limit: 20 });
 */

import type { GetData, GetJson, GetArrayItem, components } from '@ratingo/api-contract';
import { apiGet, apiPost } from './client';

/**
 * Pagination params for list endpoints.
 */
export interface PaginationParams {
  limit?: number;
  offset?: number;
}

/**
 * Trending shows query params.
 */
export interface TrendingShowsParams extends PaginationParams {
  sort?: 'trending' | 'rating' | 'popularity';
}

/**
 * Trending movies query params.
 */
export interface TrendingMoviesParams extends PaginationParams {
  sort?: 'trending' | 'rating' | 'popularity';
}

/**
 * Search query params.
 */
export interface SearchParams extends PaginationParams {
  query: string;
}

/**
 * Show details by slug (unwrapped from {success, data}).
 */
export type ShowDetailsDto = GetData<'/api/catalog/shows/{slug}'>;

/**
 * Movie details by slug (unwrapped from {success, data}).
 */
export type MovieDetailsDto = GetData<'/api/catalog/movies/{slug}'>;

/**
 * Hero block data (array unwrapped from {success, data} by apiGet).
 */
export type HeroData = GetArrayItem<'/api/home/hero'>[];

/**
 * Hero block item (Top 3).
 */
export type HeroItemDto = GetArrayItem<'/api/home/hero'>;

/**
 * Trending shows response (has {data, meta} structure).
 */
export type TrendingShowsDto = GetData<'/api/catalog/shows/trending'>;

/**
 * Trending show list item.
 */
export type ShowTrendingItemDto = components['schemas']['ShowTrendingItemDto'];

/**
 * Calendar response.
 */
export type CalendarResponseDto = GetData<'/api/catalog/shows/calendar'>;

/**
 * New episodes item.
 */
export interface NewEpisodeItem {
  showId: string;
  slug: string;
  title: string;
  posterPath: string | null;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  airDate: string;
}

/**
 * New episodes response.
 */
export interface NewEpisodesDto {
  data: NewEpisodeItem[];
}

/**
 * Trending movies response.
 */
export type TrendingMoviesDto = GetData<'/api/catalog/movies/trending'>;

/**
 * Now playing movies response.
 */
export type NowPlayingMoviesDto = GetData<'/api/catalog/movies/now-playing'>;

/**
 * New releases movies response.
 */
export type NewReleasesMoviesDto = GetData<'/api/catalog/movies/new-releases'>;

/**
 * New on digital movies response.
 */
export type NewOnDigitalMoviesDto = GetData<'/api/catalog/movies/new-on-digital'>;

/**
 * Search response (unwrapped from {success, data}).
 */
export type SearchDto = GetData<'/api/catalog/search'>;

/**
 * Import result DTO from api-contract.
 */
export type ImportResultDto = components['schemas']['ImportResultDto'];

/**
 * Import status type (derived from API schema).
 */
export type ImportStatus = ImportResultDto['status'];

/**
 * Media type (derived from API schema).
 */
export type MediaType = 'movie' | 'show';

/**
 * Import status constants for type-safe comparisons.
 */
export const ImportStatus = {
  EXISTS: 'exists' as const,
  IMPORTING: 'importing' as const,
  READY: 'ready' as const,
  FAILED: 'failed' as const,
  NOT_FOUND: 'not_found' as const,
};

/**
 * Media type constants for type-safe comparisons.
 */
export const MediaType = {
  MOVIE: 'movie' as const,
  SHOW: 'show' as const,
};

/**
 * Catalog API client.
 */
export const catalogApi = {
  /**
   * Fetches hero block items (Top 3 hottest media).
   *
   * @param params - Query parameters
   * @returns Hero items array (unwrapped)
   *
   * @example
   * const heroItems = await catalogApi.getHeroItems({ type: 'show' });
   */
  async getHeroItems(params?: { type?: 'show' | 'movie' }): Promise<HeroData> {
    return apiGet<HeroData>('home/hero', {
      searchParams: params as Record<string, string>,
    });
  },

  /**
   * Fetches trending shows.
   *
   * @param params - Query parameters
   * @returns Trending shows data (unwrapped)
   *
   * @example
   * const trendingData = await catalogApi.getTrendingShows({ limit: 20 });
   */
  async getTrendingShows(params?: TrendingShowsParams): Promise<TrendingShowsDto> {
    return apiGet<TrendingShowsDto>('catalog/shows/trending', {
      searchParams: params as Record<string, string | number>,
    });
  },

  /**
   * Fetches show details by slug.
   *
   * @param slug - Show slug
   * @returns Show details
   *
   * @example
   * const show = await catalogApi.getShowBySlug('squid-game');
   */
  async getShowBySlug(slug: string): Promise<ShowDetailsDto> {
    return apiGet<ShowDetailsDto>(`catalog/shows/${slug}`);
  },

  /**
   * Fetches show calendar.
   *
   * @param params - Query parameters
   * @returns Calendar response
   *
   * @example
   * const calendar = await catalogApi.getShowCalendar({ days: 7 });
   */
  async getShowCalendar(params?: {
    startDate?: string;
    days?: number;
  }): Promise<CalendarResponseDto> {
    return apiGet<CalendarResponseDto>('catalog/shows/calendar', {
      searchParams: params as Record<string, string | number>,
    });
  },

  /**
   * Fetches movie details by slug.
   *
   * @param slug - Movie slug
   * @returns Movie details
   *
   * @example
   * const movie = await catalogApi.getMovieBySlug('dune-part-two');
   */
  async getMovieBySlug(slug: string): Promise<MovieDetailsDto> {
    return apiGet<MovieDetailsDto>(`catalog/movies/${slug}`);
  },

  /**
   * Fetches trending movies.
   */
  async getTrendingMovies(params?: TrendingMoviesParams): Promise<TrendingMoviesDto> {
    return apiGet<TrendingMoviesDto>('catalog/movies/trending', {
      searchParams: params as Record<string, string | number>,
    });
  },

  /**
   * Fetches movies currently in theaters.
   */
  async getNowPlayingMovies(params?: PaginationParams): Promise<NowPlayingMoviesDto> {
    return apiGet<NowPlayingMoviesDto>('catalog/movies/now-playing', {
      searchParams: params as Record<string, string | number>,
    });
  },

  /**
   * Fetches movies recently released in theaters.
   */
  async getNewReleasesMovies(params?: PaginationParams): Promise<NewReleasesMoviesDto> {
    return apiGet<NewReleasesMoviesDto>('catalog/movies/new-releases', {
      searchParams: params as Record<string, string | number>,
    });
  },

  /**
   * Fetches movies recently released on digital platforms.
   */
  async getNewOnDigitalMovies(params?: PaginationParams): Promise<NewOnDigitalMoviesDto> {
    return apiGet<NewOnDigitalMoviesDto>('catalog/movies/new-on-digital', {
      searchParams: params as Record<string, string | number>,
    });
  },

  /**
   * Search movies and shows.
   */
  async search(params: SearchParams): Promise<SearchDto> {
    return apiGet<SearchDto>('catalog/search', {
      searchParams: params as unknown as Record<string, string | number>,
    });
  },

  /**
   * Fetches shows with new episodes (update feed).
   *
   * @param params - Query parameters
   * @returns New episodes data
   *
   * @example
   * const newEpisodes = await catalogApi.getNewEpisodes({ days: 7, limit: 20 });
   */
  async getNewEpisodes(params?: { days?: number; limit?: number }): Promise<NewEpisodesDto> {
    return apiGet<NewEpisodesDto>('catalog/shows/new-episodes', {
      searchParams: params as Record<string, string | number>,
    });
  },

  /**
   * Triggers on-demand import of a movie from TMDB.
   */
  async importMovie(tmdbId: number): Promise<ImportResultDto> {
    return apiPost<ImportResultDto>(`catalog/import/movie/${tmdbId}`);
  },

  /**
   * Triggers on-demand import of a show from TMDB.
   */
  async importShow(tmdbId: number): Promise<ImportResultDto> {
    return apiPost<ImportResultDto>(`catalog/import/show/${tmdbId}`);
  },

  /**
   * Checks ingestion job status by job ID.
   * Use this for polling during import.
   */
  async getJobStatus(jobId: string): Promise<JobStatusDto> {
    return apiGet<JobStatusDto>(`ingestion/jobs/${jobId}`);
  },
} as const;

/**
 * Job status response from ingestion API.
 */
export interface JobStatusDto {
  id: string;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  errorMessage: string | null;
  updatedAt: string | null;
  slug: string | null;
}
