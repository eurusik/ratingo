import { fromTrendingMovie, fromTrendingShow } from '@/entities/media';
import { catalogApi, type CatalogCache, type CatalogPage } from '@/shared/api';
import type { BrowseCategory } from '../model/browse-category';
import { BROWSE_FRESHNESS_SECONDS } from '../model/browse-freshness';
import { BROWSE_PAGE_SIZE, toCatalogQuery, type BrowseState } from '../model/browse-state';
import type { FirstPageResult } from '../model/first-page';
import { toGridMedia, type GridMedia } from '../model/grid-media';

const BROWSE_CACHE: CatalogCache = { revalidateSeconds: BROWSE_FRESHNESS_SECONDS };

export interface BrowsePageRequest {
  category: BrowseCategory;
  state: BrowseState;
  offset: number;
  limit?: number;
}

export async function loadBrowsePage({
  category,
  state,
  offset,
  limit = BROWSE_PAGE_SIZE,
}: BrowsePageRequest): Promise<CatalogPage<GridMedia>> {
  const query = toCatalogQuery(state, { offset, limit });
  const { source } = category;

  if (source.type === 'show') {
    const page = await catalogApi.getShowPage(source.path, query, BROWSE_CACHE);
    return { ...page, items: page.items.map((show) => toGridMedia(fromTrendingShow(show))) };
  }

  const page = await catalogApi.getMoviePage(source.path, query, BROWSE_CACHE);
  return { ...page, items: page.items.map((movie) => toGridMedia(fromTrendingMovie(movie))) };
}

export async function loadFirstBrowsePage(
  category: BrowseCategory,
  state: BrowseState,
): Promise<FirstPageResult> {
  try {
    return { status: 'loaded', page: await loadBrowsePage({ category, state, offset: 0 }) };
  } catch (error) {
    console.error(`[browse] ${category.slug} first page failed to load`, error);
    return { status: 'failed' };
  }
}
