'use client';

import { useSyncExternalStore } from 'react';

const BEFORE_HYDRATION = Number.POSITIVE_INFINITY;
const REFRESH_MS = 60_000;

let current: number | undefined;
const listeners = new Set<() => void>();
let stopRefreshing: (() => void) | undefined;

function refresh() {
  current = Date.now();
  for (const listener of listeners) listener();
}

function refreshWhenVisible() {
  if (document.visibilityState === 'visible') refresh();
}

function startRefreshing(): () => void {
  current = Date.now();
  const timer = setInterval(refresh, REFRESH_MS);
  document.addEventListener('visibilitychange', refreshWhenVisible);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', refreshWhenVisible);
  };
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  stopRefreshing ??= startRefreshing();
  return () => {
    listeners.delete(listener);
    if (listeners.size > 0) return;
    stopRefreshing?.();
    stopRefreshing = undefined;
  };
}

function readNow(): number {
  current ??= Date.now();
  return current;
}

const readBeforeHydration = () => BEFORE_HYDRATION;

export function useClientNow(): number {
  return useSyncExternalStore(subscribe, readNow, readBeforeHydration);
}
