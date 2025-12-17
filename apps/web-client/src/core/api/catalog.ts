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
import { apiGet } from './client';

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
  q: string;
}

/**
 * Show details by slug.
 */
export type ShowDetailsDto = GetJson<'/api/catalog/shows/{slug}'>;

/**
 * Movie details by slug.
 */
export type MovieDetailsDto = GetJson<'/api/catalog/movies/{slug}'>;

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
 * Search response.
 */
export type SearchDto = GetData<'/api/catalog/search'>;

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
} as const;
