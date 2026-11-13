'use client';

import { useSyncExternalStore } from 'react';

const subscribeToNothing = () => () => {};
const readBrowserOrigin = () => window.location.origin;
const readServerOrigin = () => null;

export function useBrowserOrigin(): string | null {
  return useSyncExternalStore(subscribeToNothing, readBrowserOrigin, readServerOrigin);
}

const readBrowserPath = () =>
  `${window.location.pathname}${window.location.search}${window.location.hash}`;
const readServerPath = () => null;

export function useBrowserPath(): string | null {
  return useSyncExternalStore(subscribeToNothing, readBrowserPath, readServerPath);
}
