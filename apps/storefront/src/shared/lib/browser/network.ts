'use client';

import { useSyncExternalStore } from 'react';

function subscribeToConnection(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const readIsOffline = () => !navigator.onLine;
const readServerIsOffline = () => false;

export function useIsOffline(): boolean {
  return useSyncExternalStore(subscribeToConnection, readIsOffline, readServerIsOffline);
}
