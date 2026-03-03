/**
 * React Query hooks for catalog API.
 *
 * Provides type-safe hooks with automatic caching and refetching.
 *
 * @example
 * import { useShowDetails } from '@/core/query/hooks';
 * const { data: show, isLoading } = useShowDetails('squid-game');
 */

import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import type { components } from '@ratingo/api-contract';
import {
  catalogApi,
  type ShowDetailsDto,
  type TrendingShowsDto,
  type ProviderDto,
} from '../api/catalog.client';
import { queryKeys } from './keys';
import type { TrendingShowsParams } from '../api/catalog.client';

/**
 * Hook for fetching trending shows.
 *
 * @param params - Query parameters
 * @param options - React Query options
 * @returns Query result with trending shows
 *
 * @example
 * const { data, isLoading } = useTrendingShows({ limit: 20 });
 */
export function useTrendingShows(
  params?: TrendingShowsParams,
  options?: Omit<UseQueryOptions<TrendingShowsDto>, 'queryKey' | 'queryFn'>,
): UseQueryResult<TrendingShowsDto> {
  return useQuery({
    queryKey: queryKeys.shows.trending(params?.limit, params?.offset, params?.sort),
    queryFn: () => catalogApi.getTrendingShows(params),
    ...options,
  });
}

/**
 * Hook for fetching show details by slug.
 *
 * @param slug - Show slug
 * @param options - React Query options
 * @returns Query result with show details
 *
 * @example
 * const { data: show, isLoading } = useShowDetails('squid-game');
 */
export function useShowDetails(
  slug: string,
  options?: Omit<UseQueryOptions<ShowDetailsDto>, 'queryKey' | 'queryFn'>,
): UseQueryResult<ShowDetailsDto> {
  return useQuery({
    queryKey: queryKeys.shows.detail(slug),
    queryFn: () => catalogApi.getShowBySlug(slug),
    ...options,
  });
}

/**
 * Hook for fetching show calendar.
 *
 * @param params - Query parameters
 * @param options - React Query options
 * @returns Query result with calendar
 *
 * @example
 * const { data: calendar } = useShowCalendar({ days: 7 });
 */
export function useShowCalendar(
  params?: { startDate?: string; days?: number },
  options?: Omit<UseQueryOptions<CalendarResponseDto>, 'queryKey' | 'queryFn'>,
): UseQueryResult<CalendarResponseDto> {
  return useQuery({
    queryKey: queryKeys.shows.calendar(params?.startDate, params?.days),
    queryFn: () => catalogApi.getShowCalendar(params),
    ...options,
  });
}

/**
 * Hook for fetching the personalized show calendar (episodes from shows the user is watching).
 *
 * Mirrors useShowCalendar but uses a distinct query key (includes 'personalized')
 * and always passes personalized: true to the API.
 *
 * Only call this hook when the user is authenticated — the API returns 401
 * for unauthenticated requests with personalized=true.
 *
 * @param params - Query parameters (startDate, days)
 * @param options - React Query options
 * @returns Query result with personalized calendar
 *
 * @example
 * const { data: calendar } = usePersonalizedShowCalendar({ startDate: '2024-03-01', days: 7 });
 */
export function usePersonalizedShowCalendar(
  params?: { startDate?: string; days?: number },
  options?: Omit<UseQueryOptions<components['schemas']['CalendarResponseDto']>, 'queryKey' | 'queryFn'>,
): UseQueryResult<components['schemas']['CalendarResponseDto']> {
  return useQuery({
    queryKey: queryKeys.shows.personalizedCalendar(params?.startDate, params?.days),
    queryFn: () => catalogApi.getShowCalendar({ ...params, personalized: true }),
    ...options,
  });
}

/**
 * Gets streaming providers.
 *
 * @param {UseQueryOptions} options - Query options
 * @returns {UseQueryResult<ProviderDto[]>} Providers list
 *
 * @example
 * const { data: providers, isLoading } = useProviders();
 */
export function useProviders(
  options?: Omit<UseQueryOptions<ProviderDto[]>, 'queryKey' | 'queryFn'>,
): UseQueryResult<ProviderDto[]> {
  return useQuery({
    queryKey: queryKeys.catalog.providers,
    queryFn: () => catalogApi.getProviders(),
    staleTime: 1000 * 60 * 5, // 5 minutes
    ...options,
  });
}
