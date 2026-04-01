'use client';

import { useState, useCallback } from 'react';
import { PAGE_SIZE, MAX_LIST_LIMIT, type MeListSort, type MediaTypeFilter } from './use-me-lists';

export function useMeListState(initialSort: MeListSort = 'recent') {
  const [sort, setSort] = useState<MeListSort>(initialSort);
  const [mediaType, setMediaType] = useState<MediaTypeFilter>('all');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const handleSortChange = useCallback((newSort: MeListSort) => {
    setSort(newSort);
    setLimit(PAGE_SIZE);
  }, []);

  const handleMediaTypeChange = useCallback((value: MediaTypeFilter) => {
    setMediaType(value);
    setLimit(PAGE_SIZE);
  }, []);

  const handleLoadMore = useCallback(() => {
    setLimit((prev) => Math.min(prev + PAGE_SIZE, MAX_LIST_LIMIT));
  }, []);

  return { sort, mediaType, limit, handleSortChange, handleMediaTypeChange, handleLoadMore };
}
