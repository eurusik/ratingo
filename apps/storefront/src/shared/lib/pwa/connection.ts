'use client';

import { useSyncExternalStore } from 'react';

const CONNECTION_EVENTS = ['online', 'offline'] as const;

function subscribeToConnection(onChange: () => void): () => void {
  CONNECTION_EVENTS.forEach((event) => window.addEventListener(event, onChange));
  return () => CONNECTION_EVENTS.forEach((event) => window.removeEventListener(event, onChange));
}

const readOnline = () => navigator.onLine;
const readServerOnline = () => false;

export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribeToConnection, readOnline, readServerOnline);
}

const subscribeToNothing = () => () => undefined;
const readHasHistory = () => window.history.length > 1;
const readServerHasHistory = () => false;

export function useHasBrowserHistory(): boolean {
  return useSyncExternalStore(subscribeToNothing, readHasHistory, readServerHasHistory);
}
