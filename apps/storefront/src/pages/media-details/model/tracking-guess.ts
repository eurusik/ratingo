'use client';

import { useSyncExternalStore } from 'react';
import { tokenStorage } from '@ratingo/web-core/auth';
import { recallWatchedCount } from '@/entities/episode';

export type TrackingGuess = 'guest' | 'start' | 'watching';

export function guessTracking(hasSession: boolean, watchedCount: number): TrackingGuess {
  if (!hasSession) return 'guest';
  return watchedCount > 0 ? 'watching' : 'start';
}

const ignoreChanges = () => () => {};
const guessOnServer = (): TrackingGuess => 'guest';

export function useTrackingGuess(showId: string | undefined): TrackingGuess {
  return useSyncExternalStore(
    ignoreChanges,
    () =>
      guessTracking(
        tokenStorage.getRefreshToken() !== null,
        showId ? recallWatchedCount(showId) : 0,
      ),
    guessOnServer,
  );
}
