'use client';

import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@/shared/lib';
import { fetchBrowseTotal } from '../api/browse-client';
import type { BrowseCategorySlug } from './browse-category';
import { browseCountKey } from './browse-keys';
import { browseSearchParams, type BrowseState } from './browse-state';

const COUNT_DEBOUNCE_MS = 300;
export const BROWSE_COUNT_STALE_MS = 60_000;

export function useBrowseCount(slug: BrowseCategorySlug, state: BrowseState, enabled: boolean) {
  const debounced = useDebouncedValue(state, COUNT_DEBOUNCE_MS);
  const isSettled =
    browseSearchParams(debounced).toString() === browseSearchParams(state).toString();

  const query = useQuery({
    queryKey: browseCountKey(slug, debounced),
    queryFn: ({ signal }) => fetchBrowseTotal(slug, debounced, signal),
    enabled,
    staleTime: BROWSE_COUNT_STALE_MS,
  });

  return { count: isSettled ? query.data : undefined, isUnavailable: isSettled && query.isError };
}
