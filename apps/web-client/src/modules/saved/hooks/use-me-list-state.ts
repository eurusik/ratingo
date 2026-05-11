'use client';

import { useState, useCallback } from 'react';
import { type MeListSort, type MediaTypeFilter } from './use-me-lists';

export function useMeListState(initialSort: MeListSort = 'recent') {
  const [sort, setSort] = useState<MeListSort>(initialSort);
  const [mediaType, setMediaType] = useState<MediaTypeFilter>('all');

  const handleSortChange = useCallback((newSort: MeListSort) => {
    setSort(newSort);
  }, []);

  const handleMediaTypeChange = useCallback((value: MediaTypeFilter) => {
    setMediaType(value);
  }, []);

  return { sort, mediaType, handleSortChange, handleMediaTypeChange };
}
