'use client';

import { useCallback, useSyncExternalStore } from 'react';

const OPEN_OVERLAY_SELECTOR = '[role="dialog"], [role="alertdialog"], .toast';

const subscribeToNothing = () => () => {};
const readHasOpenOverlay = () => document.querySelector(OPEN_OVERLAY_SELECTOR) !== null;
const readServerHasOpenOverlay = () => true;

export function useHasOpenOverlay(isWatching: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!isWatching) return subscribeToNothing();
      const observer = new MutationObserver(onChange);
      observer.observe(document.body, { childList: true, subtree: true });
      return () => observer.disconnect();
    },
    [isWatching],
  );

  return useSyncExternalStore(subscribe, readHasOpenOverlay, readServerHasOpenOverlay);
}
