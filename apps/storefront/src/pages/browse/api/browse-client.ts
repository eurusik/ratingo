import type { CatalogPage } from '@/shared/api';
import type { BrowseCategorySlug } from '../model/browse-category';
import { browseSearchParams, type BrowseState } from '../model/browse-state';
import type { GridMedia } from '../model/grid-media';
import { BROWSE_LIMIT_PARAM, BROWSE_OFFSET_PARAM } from './browse-paging';

const BROWSE_API_ROUTE = '/api/browse';

interface BrowseFetch {
  slug: BrowseCategorySlug;
  state: BrowseState;
  offset: number;
  limit: number;
  signal?: AbortSignal;
}

export async function fetchBrowsePage({
  slug,
  state,
  offset,
  limit,
  signal,
}: BrowseFetch): Promise<CatalogPage<GridMedia>> {
  const params = browseSearchParams(state);
  params.set(BROWSE_OFFSET_PARAM, String(offset));
  params.set(BROWSE_LIMIT_PARAM, String(limit));

  const response = await fetch(`${BROWSE_API_ROUTE}/${slug}?${params}`, { signal });
  if (!response.ok) throw new Error(`Browse page request failed with ${response.status}`);
  return (await response.json()) as CatalogPage<GridMedia>;
}

export async function fetchBrowseTotal(
  slug: BrowseCategorySlug,
  state: BrowseState,
  signal?: AbortSignal,
): Promise<number> {
  return (await fetchBrowsePage({ slug, state, offset: 0, limit: 1, signal })).total;
}
