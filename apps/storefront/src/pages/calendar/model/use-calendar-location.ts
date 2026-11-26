'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CALENDAR_MODE_PARAM, CALENDAR_TYPE_PARAM } from '@/shared/config';
import type { DateKey } from './calendar-dates';
import { calendarHref, parseCalendarLocation, type CalendarLocation } from './calendar-query';

interface TrackedLocation {
  href: string;
  location: CalendarLocation;
}

interface LocationState extends TrackedLocation {
  seenUrlHref: string;
  unseenOwnHrefs: readonly string[];
}

function useUrlLocation(today: DateKey): TrackedLocation {
  const searchParams = useSearchParams();
  const location = parseCalendarLocation(
    {
      week: searchParams?.get('week') ?? undefined,
      mode: searchParams?.get(CALENDAR_MODE_PARAM) ?? undefined,
      type: searchParams?.get(CALENDAR_TYPE_PARAM) ?? undefined,
    },
    today,
  );
  return { href: calendarHref(location, today), location };
}

function initialState(url: TrackedLocation): LocationState {
  return { ...url, seenUrlHref: url.href, unseenOwnHrefs: [] };
}

function followUrl(state: LocationState, url: TrackedLocation): LocationState {
  if (url.href === state.seenUrlHref) return state;
  const ownIndex = state.unseenOwnHrefs.indexOf(url.href);
  if (ownIndex === -1) return initialState(url);
  return {
    ...state,
    seenUrlHref: url.href,
    unseenOwnHrefs: state.unseenOwnHrefs.slice(ownIndex + 1),
  };
}

function useSyncHistoryHref(href: string): void {
  useEffect(() => {
    const { pathname, search } = window.location;
    if (pathname + search === href) return;
    window.history.replaceState(window.history.state, '', href);
  }, [href]);
}

export function useCalendarLocation(today: DateKey) {
  const url = useUrlLocation(today);
  const [state, setState] = useState(() => initialState(url));
  const resolved = followUrl(state, url);
  if (resolved !== state) setState(resolved);
  useSyncHistoryHref(resolved.href);

  const changeLocation = (next: CalendarLocation) => {
    const href = calendarHref(next, today);
    setState((previous) => ({
      ...previous,
      href,
      location: next,
      unseenOwnHrefs: [...previous.unseenOwnHrefs, href],
    }));
  };

  return [resolved.location, changeLocation] as const;
}
