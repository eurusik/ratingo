import { fromTrendingMovie, fromTrendingShow, type TrendingMedia } from '@/entities/media';
import { catalogApi, type CatalogCache, type CatalogPage } from '@/shared/api';
import type { BrowseCategory } from '../model/browse-category';
import { BROWSE_PAGE_SIZE, toCatalogQuery, type BrowseState } from '../model/browse-state';

const BROWSE_CACHE: CatalogCache = { revalidateSeconds: 60 };

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
}: BrowsePageRequest): Promise<CatalogPage<TrendingMedia>> {
  const query = toCatalogQuery(state, { offset, limit });
  const { source } = category;

  if (source.type === 'show') {
    const page = await catalogApi.getShowPage(source.path, query, BROWSE_CACHE);
    return { ...page, items: page.items.map(fromTrendingShow) };
  }

  const page = await catalogApi.getMoviePage(source.path, query, BROWSE_CACHE);
  return { ...page, items: page.items.map(fromTrendingMovie) };
}
