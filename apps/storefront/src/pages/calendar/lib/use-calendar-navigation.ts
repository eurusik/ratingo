'use client';

import type { RefObject } from 'react';
import type { CalendarMediaType } from '@/shared/api';
import { track } from '@/shared/lib';
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

  const tryStep = (direction: WeekStep, action: 'step' | 'swipe' = 'step'): boolean => {
    const nextWeekStart = addDays(location.weekStart, direction * WEEK_LENGTH);
    if (!isSupportedWeek(nextWeekStart)) return false;
    track('calendar_change', { action });
    goTo({ ...location, weekStart: nextWeekStart });
    return true;
  };

  return {
    tryStep,
    goToNextWeek: () => {
      tryStep(1);
    },
    goToWeekOf: (day: DateKey) => {
      const weekStart = weekStartOf(day);
      if (!isSupportedWeek(weekStart)) return;
      track('calendar_change', { action: 'next_premiere' });
      goTo({ ...location, weekStart });
    },
    goToThisWeek: () => {
      track('calendar_change', { action: 'this_week' });
      goTo({ ...location, weekStart: weekStartOf(today) });
    },
    changeMode: (mode: CalendarMode) => {
      track('calendar_change', { action: 'mode', mode });
      goTo({ ...location, mode });
    },
    changeType: (type: CalendarMediaType) => {
      track('calendar_change', { action: 'type', media_type: type });
      setLocation({ ...location, type, mode: undefined });
      scrollToListStart(list.current);
    },
    keepResolvedMode: () => setLocation(withResolvedMode(location)),
  };
}
