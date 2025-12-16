/**
 * Typed catalog API client.
 *
 * Provides type-safe methods for catalog endpoints using api-contract types.
 *
 * @example
 * import { catalogApi } from '@/core/api/catalog';
 * const shows = await catalogApi.getTrendingShows({ limit: 20 });
 */

import type { GetData } from '@ratingo/api-contract';
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
 * Trending shows response.
 */
export type TrendingShowsDto = GetData<'/api/catalog/shows/trending'>;

/**
 * Trending shows item.
 */
export type ShowTrendingItemDto = TrendingShowsDto['data'][number];

/**
 * Calendar response.
 */
export type CalendarResponseDto = GetData<'/api/catalog/shows/calendar'>;

/**
 * Catalog API client.
 */
export const catalogApi = {
  /**
   * Fetches trending shows.
   *
   * @param params - Query parameters
   * @returns Trending shows response
   *
   * @example
   * const response = await catalogApi.getTrendingShows({ limit: 20 });
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
