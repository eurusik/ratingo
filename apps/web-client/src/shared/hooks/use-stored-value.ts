import { useCallback, useSyncExternalStore } from 'react';

function subscribeToStorage(onChange: () => void) {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
}

function readNothingOnServer() {
  return null;
}

function readStoredValue(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useStoredValue(key: string): string | null {
  const readValue = useCallback(() => readStoredValue(key), [key]);
  return useSyncExternalStore(subscribeToStorage, readValue, readNothingOnServer);
}
