'use client';

import { useEffect } from 'react';
import { SEARCH_PARAM } from '@/shared/config';
import { openSearchFor } from './search-dialog-state';

export function useSearchFromUrl(): void {
  useEffect(() => {
    const url = new URL(window.location.href);
    const query = url.searchParams.get(SEARCH_PARAM)?.trim();
    if (!query) return;
    url.searchParams.delete(SEARCH_PARAM);
    window.history.replaceState(window.history.state, '', url);
    openSearchFor(query);
  }, []);
}
