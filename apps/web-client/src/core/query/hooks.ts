import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import type { components } from '@ratingo/api-contract';
import {
  catalogApi,
  type ShowDetailsDto,
  type TrendingShowsDto,
  type CalendarResponseDto,
  type ProviderDto,
} from '../api/catalog.client';
import { queryKeys } from './keys';
import type { TrendingShowsParams } from '../api/catalog.client';

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

export function useShowCalendar(
  params?: { startDate?: string; days?: number },
  options?: Omit<UseQueryOptions<components['schemas']['CalendarResponseDto']>, 'queryKey' | 'queryFn'>,
): UseQueryResult<components['schemas']['CalendarResponseDto']> {
  return useQuery({
    queryKey: queryKeys.shows.calendar(params?.startDate, params?.days),
    queryFn: () => catalogApi.getShowCalendar(params),
    ...options,
  });
}

/**
 * Mirrors useShowCalendar but uses a distinct query key (includes 'personalized')
 * and always passes personalized: true to the API.
 *
 * Only call this hook when the user is authenticated — the API returns 401
 * for unauthenticated requests with personalized=true.
 */
export function usePersonalizedShowCalendar(
  params?: { startDate?: string; days?: number },
  options?: Omit<UseQueryOptions<components['schemas']['CalendarResponseDto']>, 'queryKey' | 'queryFn'>,
): UseQueryResult<components['schemas']['CalendarResponseDto']> {
  return useQuery({
    queryKey: queryKeys.shows.personalizedCalendar(params?.startDate, params?.days),
    queryFn: () => catalogApi.getShowCalendar({ ...params, personalized: 'true' }),
    ...options,
  });
}

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
