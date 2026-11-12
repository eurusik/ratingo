'use client';

import { useQuery } from '@tanstack/react-query';
import { fromTrendingMovie, fromTrendingShow, type TrendingMedia } from '@/entities/media';
import { catalogApi } from '@/shared/api';
import { interleave } from '@/shared/lib';

const TRENDING_PER_TYPE = 10;
const TOP_COUNT = 10;
const TRENDING_STALE_MS = 10 * 60 * 1000;

interface TrendingToday {
  trending: TrendingMedia[];
  top: TrendingMedia[];
}

async function fetchTrendingToday(): Promise<TrendingToday> {
  const [shows, movies] = await Promise.all([
    catalogApi.getTrendingShows(TRENDING_PER_TYPE),
    catalogApi.getTrendingMovies(TRENDING_PER_TYPE),
  ]);
  const trendingShows = shows.map(fromTrendingShow);
  return {
    trending: interleave(trendingShows, movies.map(fromTrendingMovie)),
    top: trendingShows.slice(0, TOP_COUNT),
  };
}

export function useTrendingToday() {
  return useQuery({
    queryKey: ['catalog', 'trending-today'],
    queryFn: fetchTrendingToday,
    staleTime: TRENDING_STALE_MS,
  });
}
