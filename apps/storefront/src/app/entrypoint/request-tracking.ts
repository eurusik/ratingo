import { cache } from 'react';
import { cookies } from 'next/headers';
import { TRACKING_HINT_COOKIE, parseTrackingHints, type TrackingHints } from '@/entities/episode';

export const getTrackingHints = cache(async (): Promise<TrackingHints | null> => {
  const store = await cookies();
  return parseTrackingHints(store.get(TRACKING_HINT_COOKIE)?.value);
});
