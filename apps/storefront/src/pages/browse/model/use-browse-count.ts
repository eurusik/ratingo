'use client';

import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@/shared/lib';
import type { BrowseCategorySlug } from './browse-category';
import { browseCountQuery } from './browse-queries';
import { browseStateKey, type BrowseState } from './browse-state';

const COUNT_DEBOUNCE_MS = 300;

interface KnownTotal {
  state: BrowseState;
  total: number;
}

export function useBrowseCount(
  slug: BrowseCategorySlug,
  draft: BrowseState,
  known: KnownTotal | undefined,
  enabled: boolean,
) {
  const debounced = useDebouncedValue(draft, COUNT_DEBOUNCE_MS);
  const draftKey = browseStateKey(draft);
  const isSettled = browseStateKey(debounced) === draftKey;
  const isKnown = known !== undefined && browseStateKey(known.state) === draftKey;

  const query = useQuery({ ...browseCountQuery(slug, debounced), enabled: enabled && !isKnown });

  if (isKnown) return { count: known.total, isUnavailable: false };
  return {
    count: isSettled ? query.data : undefined,
    isUnavailable: isSettled && query.isError,
  };
}
