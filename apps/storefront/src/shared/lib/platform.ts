'use client';

import { useSyncExternalStore } from 'react';

const APPLE_PLATFORM = /Mac|iPhone|iPad|iPod/;

const subscribeToNothing = () => () => {};
const readIsApple = () => APPLE_PLATFORM.test(navigator.platform || navigator.userAgent);
const readServerIsApple = () => null;

export function useIsApplePlatform(): boolean | null {
  return useSyncExternalStore(subscribeToNothing, readIsApple, readServerIsApple);
}
