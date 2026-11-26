import type { CalendarMediaType, CalendarRangeQuery } from '@/shared/api';
import { CALENDAR_MODE_PARAM, CALENDAR_ROUTE, CALENDAR_TYPE_PARAM } from '@/shared/config';
import {
  addDays,
  isDateKey,
  isSupportedWeek,
  weekStartOf,
  WEEK_LENGTH,
  type DateKey,
} from './calendar-dates';

const CALENDAR_MODES = ['mine', 'premieres', 'all'] as const;

export const CALENDAR_TYPES = ['show', 'movie'] as const satisfies readonly CalendarMediaType[];

const DEFAULT_CALENDAR_TYPE: CalendarMediaType = 'show';

const RANGE_LEAD_DAYS = 1;
const UPCOMING_LOOKAHEAD_DAYS = 90;

export type CalendarMode = (typeof CALENDAR_MODES)[number];

const MODES_BY_TYPE = {
  show: CALENDAR_MODES,
  movie: ['mine', 'all'],
} as const satisfies Record<CalendarMediaType, readonly CalendarMode[]>;

export function calendarModesFor(type: CalendarMediaType): readonly CalendarMode[] {
  return MODES_BY_TYPE[type];
}

export interface CalendarSearchParams {
  week?: string | string[];
  mode?: string | string[];
  type?: string | string[];
}

export interface CalendarLocation {
  weekStart: DateKey;
  mode?: CalendarMode;
  type: CalendarMediaType;
}

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function modeFor(type: CalendarMediaType, value: string | undefined): CalendarMode | undefined {
  return calendarModesFor(type).find((mode) => mode === value);
}

function isCalendarType(value: string | undefined): value is CalendarMediaType {
  return CALENDAR_TYPES.some((type) => type === value);
}

export function parseCalendarType(value: string | string[] | undefined): CalendarMediaType {
  const type = single(value);
  return isCalendarType(type) ? type : DEFAULT_CALENDAR_TYPE;
}

export function parseCalendarLocation(
  params: CalendarSearchParams,
  today: DateKey,
): CalendarLocation {
  const week = single(params.week);
  const type = parseCalendarType(params.type);
  const requestedWeekStart = week && isDateKey(week) ? weekStartOf(week) : undefined;
  return {
    weekStart:
      requestedWeekStart && isSupportedWeek(requestedWeekStart)
        ? requestedWeekStart
        : weekStartOf(today),
    mode: modeFor(type, single(params.mode)),
    type,
  };
}

export function calendarHref({ weekStart, mode, type }: CalendarLocation, today: DateKey): string {
  const params = new URLSearchParams();
  if (type !== DEFAULT_CALENDAR_TYPE) params.set(CALENDAR_TYPE_PARAM, type);
  if (weekStart !== weekStartOf(today)) params.set('week', weekStart);
  if (mode) params.set(CALENDAR_MODE_PARAM, mode);
  const query = params.toString();
  return query ? `${CALENDAR_ROUTE}?${query}` : CALENDAR_ROUTE;
}

type RangeWindow = Pick<CalendarRangeQuery, 'startDate' | 'days'>;

type RangeFilters = Pick<CalendarRangeQuery, 'personalized' | 'premieres'>;

export function rangeFiltersFor(mode: CalendarMode): RangeFilters {
  return mode === 'premieres'
    ? { personalized: false, premieres: true }
    : { personalized: mode === 'mine' };
}

export function weekRequest(weekStart: DateKey): RangeWindow {
  return {
    startDate: addDays(weekStart, -RANGE_LEAD_DAYS),
    days: WEEK_LENGTH + RANGE_LEAD_DAYS,
  };
}

export function upcomingRequest(fromWeekStart: DateKey): RangeWindow {
  return { startDate: addDays(fromWeekStart, -RANGE_LEAD_DAYS), days: UPCOMING_LOOKAHEAD_DAYS };
}
