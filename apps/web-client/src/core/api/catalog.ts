/**
 * Typed catalog API client.
 *
 * Provides type-safe methods for catalog endpoints using api-contract types.
 *
 * @example
 * import { catalogApi } from '@/core/api/catalog';
 * const shows = await catalogApi.getTrendingShows({ limit: 20 });
 */

import type { GetData, GetArrayItem, components } from '@ratingo/api-contract';
import { apiGet } from './client';

/**
 * Trending shows query params.
 */
export interface TrendingShowsParams {
  limit?: number;
  offset?: number;
  sort?: 'trending' | 'rating' | 'popularity';
}

/**
 * Show details by slug.
 */
export type ShowDetailsDto = GetData<'/api/catalog/shows/{slug}'>;

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
} as const;
