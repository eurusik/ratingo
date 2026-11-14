'use client';

import { useCallback, useSyncExternalStore } from 'react';

const readServerMatch = () => false;

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  const readMatch = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, readMatch, readServerMatch);
}
