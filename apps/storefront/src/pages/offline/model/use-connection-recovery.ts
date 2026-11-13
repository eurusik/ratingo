'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

const subscribeToNothing = () => () => undefined;
const readHasHistory = () => window.history.length > 1;
const readServerHasHistory = () => false;

export function useHasBrowserHistory(): boolean {
  return useSyncExternalStore(subscribeToNothing, readHasHistory, readServerHasHistory);
}

const readStartedOffline = () => typeof navigator !== 'undefined' && !navigator.onLine;

export function useReloadWhenOnline(): boolean {
  const [startedOffline] = useState(readStartedOffline);
  const [reconnected, setReconnected] = useState(false);

  useEffect(() => {
    const reloadPage = () => {
      setReconnected(true);
      window.location.reload();
    };
    if (startedOffline && navigator.onLine) {
      reloadPage();
      return undefined;
    }
    window.addEventListener('online', reloadPage);
    return () => window.removeEventListener('online', reloadPage);
  }, [startedOffline]);

  return reconnected;
}
