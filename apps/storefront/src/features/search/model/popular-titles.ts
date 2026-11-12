'use client';

import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/shared/api';
import { interleave } from '@/shared/lib';
import { fromTrending, type SearchTitle } from './search-title';

const POPULAR_COUNT = 3;
const PER_TYPE_COUNT = 2;
const POPULAR_STALE_MS = 10 * 60 * 1000;

async function fetchPopularTitles(): Promise<SearchTitle[]> {
  const [shows, movies] = await Promise.all([
    catalogApi.getTrendingShows(PER_TYPE_COUNT),
    catalogApi.getTrendingMovies(PER_TYPE_COUNT),
  ]);
  return interleave(
    shows.map((show) => fromTrending(show, 'show')),
    movies.map((movie) => fromTrending(movie, 'movie')),
  );
}

export function usePopularTitles(): SearchTitle[] {
  const { data } = useQuery({
    queryKey: ['catalog', 'popular-now'],
    queryFn: fetchPopularTitles,
    staleTime: POPULAR_STALE_MS,
  });
  return (data ?? []).slice(0, POPULAR_COUNT);
}
