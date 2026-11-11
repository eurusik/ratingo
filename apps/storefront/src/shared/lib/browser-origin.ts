'use client';

import { useSyncExternalStore } from 'react';

const subscribeToNothing = () => () => {};
const readBrowserOrigin = () => window.location.origin;
const readServerOrigin = () => null;

export function useBrowserOrigin(): string | null {
  return useSyncExternalStore(subscribeToNothing, readBrowserOrigin, readServerOrigin);
}
