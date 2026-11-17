'use client';

import { useEffect, useRef } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/shared/api';
import { track, useDebouncedValue } from '@/shared/lib';
import { fromSearchItem, type SearchTitle } from './search-title';

const MIN_QUERY_LENGTH = 2;

const DEBOUNCE_MS = 300;
const RESULTS_STALE_MS = 5 * 60 * 1000;

export type SearchFilter = 'all' | SearchTitle['type'];

export interface SearchResults {
  catalog: SearchTitle[];
  more: SearchTitle[];
}

function matchesFilter(filter: SearchFilter) {
  return (title: SearchTitle) => filter === 'all' || title.type === filter;
}

export function useCatalogSearch(query: string, filter: SearchFilter) {
  const term = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const isActive = term.length >= MIN_QUERY_LENGTH;
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ['catalog', 'search', term],
    queryFn: ({ signal }) => catalogApi.search(term, signal),
    enabled: isActive,
    staleTime: RESULTS_STALE_MS,
    placeholderData: keepPreviousData,
  });

  const keep = matchesFilter(filter);
  const results: SearchResults = {
    catalog: (data?.local ?? []).map(fromSearchItem).filter(keep),
    more: (data?.tmdb ?? []).map(fromSearchItem).filter(keep),
  };

  const lastTracked = useRef('');
  const isSettled = isActive && !isFetching && !isError && data !== undefined;
  const resultsCount = results.catalog.length + results.more.length;

  useEffect(() => {
    if (!isSettled) return;
    const key = `${term}|${filter}`;
    if (lastTracked.current === key) return;
    lastTracked.current = key;
    if (resultsCount === 0) track('search_no_results', { search_term: term, filter });
    else track('search', { results_count: resultsCount, filter });
  }, [isSettled, term, filter, resultsCount]);

  const showsResultsFor = (typed: string) =>
    isActive && !isFetching && !isError && typed.trim() === term;

  return {
    term,
    isActive,
    results,
    isSearching: isFetching,
    isError,
    retry: refetch,
    showsResultsFor,
  };
}
