'use client';

import { useCallback, useSyncExternalStore } from 'react';

const flags = new Map<string, boolean>();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRememberedFlag(
  key: string,
  initial = false,
): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => flags.get(key) ?? initial,
    () => initial,
  );
  const setValue = useCallback(
    (next: boolean) => {
      flags.set(key, next);
      listeners.forEach((listener) => listener());
    },
    [key],
  );
  return [value, setValue];
}
