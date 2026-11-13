import { currentYear } from '@/shared/lib';
import { loadFirstBrowsePage } from '../api/load-browse-page';
import type { BrowseCategory } from '../model/browse-category';
import { parseBrowseState, type BrowseSearchParams } from '../model/browse-state';
import { BrowseView } from './browse-view';

interface BrowsePageProps {
  category: BrowseCategory;
  searchParams: BrowseSearchParams;
}

export async function BrowsePage({ category, searchParams }: BrowsePageProps) {
  const year = currentYear();
  const state = parseBrowseState(category, searchParams, year);
  const firstPage = Promise.resolve(await loadFirstBrowsePage(category, state));

  return <BrowseView category={category} state={state} currentYear={year} firstPage={firstPage} />;
}
