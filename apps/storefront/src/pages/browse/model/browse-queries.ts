import { queryOptions } from '@tanstack/react-query';
import { fetchBrowseTotal } from '../api/browse-client';
import type { BrowseCategorySlug } from './browse-category';
import { BROWSE_FRESHNESS_MS } from './browse-freshness';
import { browseStateKey, type BrowseState } from './browse-state';

const BROWSE_QUERY_KEY = 'browse';

export function browseListKey(slug: BrowseCategorySlug, state: BrowseState) {
  return [BROWSE_QUERY_KEY, 'list', slug, browseStateKey(state)] as const;
}

export function browseCountQuery(slug: BrowseCategorySlug, state: BrowseState) {
  return queryOptions({
    queryKey: [BROWSE_QUERY_KEY, 'count', slug, browseStateKey(state)] as const,
    queryFn: ({ signal }) => fetchBrowseTotal(slug, state, signal),
    staleTime: BROWSE_FRESHNESS_MS,
  });
}
