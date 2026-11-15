'use client';

import type { RefObject } from 'react';
import type { WeekStep } from './use-week-carousel';
import {
  addDays,
  isSupportedWeek,
  weekStartOf,
  WEEK_LENGTH,
  type DateKey,
} from '../model/calendar-dates';
import type { CalendarLocation, CalendarMode } from '../model/calendar-query';

function scrollToListStart(list: HTMLElement | null): void {
  if (list && list.getBoundingClientRect().top < 0) list.scrollIntoView({ block: 'start' });
}

interface CalendarNavigationInputs {
  location: CalendarLocation;
  resolvedMode: CalendarMode | undefined;
  today: DateKey;
  list: RefObject<HTMLElement | null>;
  setLocation: (next: CalendarLocation) => void;
}

export function useCalendarNavigation({
  location,
  resolvedMode,
  today,
  list,
  setLocation,
}: CalendarNavigationInputs) {
  const withResolvedMode = (next: CalendarLocation): CalendarLocation => ({
    ...next,
    mode: next.mode ?? resolvedMode,
  });

  const goTo = (next: CalendarLocation) => {
    setLocation(withResolvedMode(next));
    scrollToListStart(list.current);
  };

  const tryStep = (direction: WeekStep): boolean => {
    const nextWeekStart = addDays(location.weekStart, direction * WEEK_LENGTH);
    if (!isSupportedWeek(nextWeekStart)) return false;
    goTo({ ...location, weekStart: nextWeekStart });
    return true;
  };

  return {
    tryStep,
    goToNextWeek: () => {
      tryStep(1);
    },
    goToThisWeek: () => goTo({ ...location, weekStart: weekStartOf(today) }),
    changeMode: (mode: CalendarMode) => goTo({ ...location, mode }),
    keepResolvedMode: () => setLocation(withResolvedMode(location)),
  };
}
