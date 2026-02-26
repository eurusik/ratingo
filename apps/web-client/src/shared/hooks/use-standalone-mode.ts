'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(display-mode: standalone)';

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSnapshot() {
  return (
    window.matchMedia(QUERY).matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  );
}

function getServerSnapshot() {
  return false;
}

/**
 * Returns true when the app is running as an installed PWA (standalone mode).
 * Works on both Android (display-mode: standalone) and iOS (navigator.standalone).
 */
export function useStandaloneMode() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
