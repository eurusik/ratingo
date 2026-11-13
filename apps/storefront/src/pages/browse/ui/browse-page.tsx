import type { TrendingMedia } from '@/entities/media';
import type { CatalogPage } from '@/shared/api';
import { loadBrowsePage } from '../api/load-browse-page';
import type { BrowseCategory } from '../model/browse-category';
import { parseBrowseState, type BrowseSearchParams, type BrowseState } from '../model/browse-state';
import { BrowseView } from './browse-view';

interface BrowsePageProps {
  category: BrowseCategory;
  searchParams: BrowseSearchParams;
}

async function loadFirstPage(
  category: BrowseCategory,
  state: BrowseState,
): Promise<CatalogPage<TrendingMedia> | null> {
  try {
    return await loadBrowsePage({ category, state, offset: 0 });
  } catch (error) {
    console.error(`[browse] ${category.slug} first page failed to load`, error);
    return null;
  }
}

export async function BrowsePage({ category, searchParams }: BrowsePageProps) {
  const currentYear = new Date().getFullYear();
  const state = parseBrowseState(category, searchParams, currentYear);
  const initialPage = await loadFirstPage(category, state);

  return (
    <BrowseView
      category={category}
      state={state}
      currentYear={currentYear}
      initialPage={initialPage}
    />
  );
}
