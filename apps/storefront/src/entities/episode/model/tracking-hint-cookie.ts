'use client';

import { useEffect, useRef } from 'react';
import { tokenStorage, useAuth } from '@ratingo/web-core/auth';
import {
  TRACKING_HINT_COOKIE,
  hintsChangeForSession,
  isRememberableSlug,
  parseTrackingHints,
  serializeTrackingHints,
  withTrackingState,
  type TrackingHints,
  type TrackingState,
} from './tracking-hint';

const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const COOKIE_PATH = '/';

function readHints(): TrackingHints | null {
  const prefix = `${TRACKING_HINT_COOKIE}=`;
  const cookie = document.cookie.split('; ').find((part) => part.startsWith(prefix));
  return parseTrackingHints(cookie?.slice(prefix.length));
}

function writeCookie(value: string, maxAgeSeconds: number): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  try {
    document.cookie = `${TRACKING_HINT_COOKIE}=${value}; Path=${COOKIE_PATH}; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
  } catch (error) {
    console.warn('Could not save the tracking hint', { error });
  }
}

function writeHints(hints: TrackingHints): void {
  writeCookie(serializeTrackingHints(hints), MAX_AGE_SECONDS);
}

export function rememberTrackingState(slug: string, state: Exclude<TrackingState, 'guest'>): void {
  if (!isRememberableSlug(slug)) return;
  const hints = readHints();
  const [latestSlug, latestState] = hints?.shows[0] ?? [];
  if (latestSlug === slug && latestState === state) return;
  writeHints(withTrackingState(hints, slug, state));
}

function forgetTrackingHints(): void {
  writeCookie('', 0);
}

export function useTrackingHintsSession(): void {
  const { user, isLoading } = useAuth();
  const userId = user?.id ?? null;
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    const change = hintsChangeForSession({
      previousUserId: previousUserId.current,
      userId,
      hasRefreshToken: tokenStorage.getRefreshToken() !== null,
      hasHints: readHints() !== null,
    });
    previousUserId.current = userId;
    if (change === 'forget') forgetTrackingHints();
    if (change === 'reset') writeHints({ shows: [] });
  }, [isLoading, userId]);
}
