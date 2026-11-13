'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';

const subscribeToNothing = () => () => undefined;
const readHasHistory = () => window.history.length > 1;
const readServerHasHistory = () => false;

export function useHasBrowserHistory(): boolean {
  return useSyncExternalStore(subscribeToNothing, readHasHistory, readServerHasHistory);
}

export function useReloadWhenOnline(): boolean {
  const [reconnected, setReconnected] = useState(false);

  useEffect(() => {
    const reloadPage = () => {
      setReconnected(true);
      window.location.reload();
    };
    window.addEventListener('online', reloadPage);
    return () => window.removeEventListener('online', reloadPage);
  }, []);

  return reconnected;
}
