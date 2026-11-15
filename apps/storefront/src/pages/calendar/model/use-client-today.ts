'use client';

import { useClientNow } from '@/shared/lib';
import { kyivDateKey, type DateKey } from './calendar-dates';

export function useClientToday(serverToday: DateKey): DateKey {
  const now = useClientNow();
  return Number.isFinite(now) ? kyivDateKey(new Date(now)) : serverToday;
}
