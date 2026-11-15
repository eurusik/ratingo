'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DateKey } from '../model/calendar-dates';

const USER_SCROLL_EVENTS = ['pointerdown', 'touchstart', 'wheel', 'keydown'] as const;

interface PinnedDay {
  weekKey: DateKey;
  day: DateKey;
}

export function usePinnedDay(weekKey: DateKey): [DateKey | undefined, (day: DateKey) => void] {
  const [pinned, setPinned] = useState<PinnedDay>();
  const pinnedDay = pinned?.weekKey === weekKey ? pinned.day : undefined;

  useEffect(() => {
    if (pinnedDay === undefined) return;
    const release = () => setPinned(undefined);
    USER_SCROLL_EVENTS.forEach((type) =>
      window.addEventListener(type, release, { once: true, passive: true }),
    );
    return () => USER_SCROLL_EVENTS.forEach((type) => window.removeEventListener(type, release));
  }, [pinnedDay]);

  const pinDay = useCallback((day: DateKey) => setPinned({ weekKey, day }), [weekKey]);
  return [pinnedDay, pinDay];
}
