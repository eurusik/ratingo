'use client';

import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
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

  const query = useQuery({
    ...browseCountQuery(slug, debounced),
    enabled: enabled && !isKnown,
    placeholderData: keepPreviousData,
  });

  const freshCount = isKnown ? known.total : query.data;
  const [lastCount, setLastCount] = useState(freshCount);
  if (freshCount !== undefined && freshCount !== lastCount) setLastCount(freshCount);

  const isUpdating = !isKnown && (!isSettled || query.isPlaceholderData || query.isFetching);

  return {
    count: freshCount ?? lastCount,
    isUpdating,
    isUnavailable: !isKnown && isSettled && query.isError,
  };
}
