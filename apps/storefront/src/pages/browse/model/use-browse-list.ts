'use client';

import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { CatalogPage } from '@/shared/api';
import { fetchBrowsePage } from '../api/browse-client';
import type { BrowseCategorySlug } from './browse-category';
import { BROWSE_FRESHNESS_MS } from './browse-freshness';
import { browseListKey } from './browse-queries';
import { BROWSE_PAGE_SIZE, type BrowseState } from './browse-state';
import type { GridMedia } from './grid-media';

const LIST_STALE_MS = 5 * BROWSE_FRESHNESS_MS;

function uniqueItems(pages: readonly CatalogPage<GridMedia>[]): GridMedia[] {
  const byId = new Map<string, GridMedia>();
  for (const media of pages.flatMap((page) => page.items)) {
    if (!byId.has(media.mediaItemId)) byId.set(media.mediaItemId, media);
  }
  return [...byId.values()];
}

export function useBrowseList(
  slug: BrowseCategorySlug,
  state: BrowseState,
  initialPage: CatalogPage<GridMedia>,
) {
  const query = useInfiniteQuery({
    queryKey: browseListKey(slug, state),
    queryFn: ({ pageParam, signal }) =>
      fetchBrowsePage({ slug, state, offset: pageParam, limit: BROWSE_PAGE_SIZE, signal }),
    initialPageParam: 0,
    initialData: { pages: [initialPage], pageParams: [0] },
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore && lastPage.items.length > 0 ? pages.length * BROWSE_PAGE_SIZE : undefined,
    staleTime: LIST_STALE_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const items = useMemo(() => uniqueItems(query.data.pages), [query.data.pages]);

  return { query, items };
}
