'use client';

import { useEffect } from 'react';
import {
  nextUpcoming,
  rememberTrackingState,
  trackingStateOf,
  type Season,
} from '@/entities/episode';
import type { EpisodesTracker } from '@/widgets/episodes-sheet';

export function useRememberTracking(slug: string, seasons: Season[], tracker: EpisodesTracker) {
  const { canTrack, isResolving, now } = tracker;
  const watched = tracker.summary.watched;
  const hasClock = Number.isFinite(now);
  const hasUpcoming = hasClock && nextUpcoming(seasons, now) !== undefined;

  useEffect(() => {
    if (isResolving || !canTrack || !hasClock) return;
    rememberTrackingState(slug, trackingStateOf(watched, hasUpcoming));
  }, [slug, isResolving, canTrack, hasClock, watched, hasUpcoming]);
}
