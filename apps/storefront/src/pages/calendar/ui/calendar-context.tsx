'use client';

import { createContext, use, type ReactNode } from 'react';
import type { CalendarMode } from '../model/calendar-query';
import type { ViewerStatus } from '../model/day-plan';
import type { StartWatching } from '../model/use-start-watching';

interface CalendarContextValue extends StartWatching {
  mode: CalendarMode;
  viewer: ViewerStatus;
  now: number;
}

const CalendarContext = createContext<CalendarContextValue | null>(null);

export function CalendarProvider({
  value,
  children,
}: {
  value: CalendarContextValue;
  children: ReactNode;
}) {
  return <CalendarContext value={value}>{children}</CalendarContext>;
}

export function useCalendarContext(): CalendarContextValue {
  const value = use(CalendarContext);
  if (!value) throw new Error('useCalendarContext must be used inside CalendarProvider');
  return value;
}
