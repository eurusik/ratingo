import type { BrowseCategorySlug } from './browse-category';
import { browseSearchParams, type BrowseState } from './browse-state';

const BROWSE_QUERY_KEY = 'browse';

export function browseListKey(slug: BrowseCategorySlug, state: BrowseState) {
  return [BROWSE_QUERY_KEY, 'list', slug, browseSearchParams(state).toString()] as const;
}

export function browseCountKey(slug: BrowseCategorySlug, state: BrowseState) {
  return [BROWSE_QUERY_KEY, 'count', slug, browseSearchParams(state).toString()] as const;
}
