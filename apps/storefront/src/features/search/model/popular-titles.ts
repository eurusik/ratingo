'use client';

import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/shared/api';
import { fromTrending, type SearchTitle } from './search-title';

const POPULAR_COUNT = 3;
const POPULAR_STALE_MS = 10 * 60 * 1000;

function interleave(first: SearchTitle[], second: SearchTitle[]): SearchTitle[] {
  const length = Math.max(first.length, second.length);
  return Array.from({ length }, (_, index) => [first[index], second[index]])
    .flat()
    .filter((title): title is SearchTitle => title !== undefined);
}

async function fetchPopularTitles(): Promise<SearchTitle[]> {
  const [shows, movies] = await Promise.all([
    catalogApi.getTrendingShows(POPULAR_COUNT),
    catalogApi.getTrendingMovies(POPULAR_COUNT),
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
