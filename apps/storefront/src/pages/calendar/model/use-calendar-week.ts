'use client';

import { useMemo } from 'react';
import { useAuth } from '@ratingo/web-core/auth';
import type { CalendarRange } from '@/shared/api';
import { addDays, WEEK_LENGTH, type DateKey } from './calendar-dates';
import { hasTrackedShows } from './calendar-range';
import {
  upcomingRequest,
  weekRequest,
  type CalendarLocation,
  type CalendarMode,
} from './calendar-query';
import type { ViewerStatus } from './day-plan';
import { useCalendarMode } from './use-calendar-mode';
import { useCalendarRange } from './use-calendar-range';
import {
  emptyCalendarDays,
  firstEpisodeFrom,
  buildStripWeek,
  groupEpisodesByDay,
  weekLayoutFor,
  type StripWeek,
} from './week-layout';

const NO_PICKABLE_DAYS: ReadonlySet<DateKey> = new Set();

interface CalendarWeekInputs {
  location: CalendarLocation;
  today: DateKey;
}

function useViewerStatus(): ViewerStatus {
  const { user, isLoading } = useAuth();
  if (isLoading) return 'resolving';
  return user ? 'signedIn' : 'guest';
}

function useActiveRange(location: CalendarLocation) {
  const request = weekRequest(location.weekStart);
  const personalized = useCalendarRange({ query: { ...request, personalized: true } });
  const mode = useCalendarMode({ requested: location.mode, personalized });
  const everyone = useCalendarRange({
    query: { ...request, personalized: false },
    isEnabled: mode !== undefined,
  });
  return { mode, active: mode === 'mine' ? personalized : everyone };
}

function likelyMode(mode: CalendarMode | undefined, viewer: ViewerStatus) {
  if (mode) return mode;
  return viewer === 'signedIn' ? 'mine' : undefined;
}

export function useCalendarWeek({ location, today }: CalendarWeekInputs) {
  const viewer = useViewerStatus();
  const { weekStart } = location;
  const { mode, active } = useActiveRange(location);
  const isGuestInMine = mode === 'mine' && viewer === 'guest';

  const days = useMemo(() => {
    if (active.data) return groupEpisodesByDay(active.data, weekStart);
    return isGuestInMine ? emptyCalendarDays(weekStart) : undefined;
  }, [active.data, isGuestInMine, weekStart]);
  const layout = useMemo(
    () => (days ? weekLayoutFor(days, weekStart, today) : undefined),
    [days, weekStart, today],
  );
  const isEmptyWeek = layout ? layout.past.length + layout.upcoming.length === 0 : false;
  const isResting = mode === 'mine' && isEmptyWeek && hasTrackedShows(active.data);

  const currentStripWeek = useMemo(() => {
    const stripDays = days ?? (active.isError ? emptyCalendarDays(weekStart) : undefined);
    return stripDays && buildStripWeek(stripDays, weekStart, today);
  }, [days, active.isError, weekStart, today]);
  const stripWeeks = useStripWeeks({
    weekStart,
    today,
    current: currentStripWeek,
    mode: likelyMode(mode, viewer),
    isEnabled: viewer !== 'resolving',
  });
  const nextEpisode = useRestingWeekNextEpisode(weekStart, isResting);

  return {
    mode,
    viewer,
    active,
    layout,
    stripWeeks,
    isGuestInMine,
    isEmptyWeek,
    isResting,
    nextEpisode,
  };
}

function useRestingWeekNextEpisode(weekStart: DateKey, isResting: boolean) {
  const nextWeekStart = addDays(weekStart, WEEK_LENGTH);
  const upcoming = useCalendarRange({
    query: { ...upcomingRequest(nextWeekStart), personalized: true },
    isEnabled: isResting,
  });
  return isResting ? firstEpisodeFrom(upcoming.data, nextWeekStart) : undefined;
}

interface NeighbourInputs {
  today: DateKey;
  mode: CalendarMode | undefined;
  isEnabled: boolean;
}

interface StripWeeksInputs extends NeighbourInputs {
  weekStart: DateKey;
  current: StripWeek | undefined;
}

const OTHER_MODE = { mine: 'all', all: 'mine' } as const satisfies Record<
  CalendarMode,
  CalendarMode
>;

function useWarmNeighbour(weekStart: DateKey, mode: CalendarMode | undefined, isEnabled: boolean) {
  useCalendarRange({
    query: { ...weekRequest(weekStart), personalized: mode === 'mine' },
    isEnabled: isEnabled && mode !== undefined,
  });
}

function useStripWeeks({ weekStart, current, ...neighbours }: StripWeeksInputs) {
  const previousWeekStart = addDays(weekStart, -WEEK_LENGTH);
  const nextWeekStart = addDays(weekStart, WEEK_LENGTH);
  const previous = useNeighbourWeek(previousWeekStart, neighbours);
  const next = useNeighbourWeek(nextWeekStart, neighbours);
  const otherMode = neighbours.mode && OTHER_MODE[neighbours.mode];
  const isReadyToWarm = neighbours.isEnabled && current !== undefined;
  useWarmNeighbour(previousWeekStart, otherMode, isReadyToWarm);
  useWarmNeighbour(nextWeekStart, otherMode, isReadyToWarm);
  return useMemo(
    () => (current ? [previous, current, next] : undefined),
    [previous, current, next],
  );
}

function useNeighbourWeek(
  weekStart: DateKey,
  { today, mode, isEnabled }: NeighbourInputs,
): StripWeek {
  const { data } = useCalendarRange({
    query: { ...weekRequest(weekStart), personalized: mode === 'mine' },
    isEnabled: isEnabled && mode !== undefined,
  });
  return useMemo(() => neighbourWeek(data, weekStart, today), [data, weekStart, today]);
}

function neighbourWeek(
  data: CalendarRange | undefined,
  weekStart: DateKey,
  today: DateKey,
): StripWeek {
  return data
    ? buildStripWeek(groupEpisodesByDay(data, weekStart), weekStart, today)
    : { days: emptyCalendarDays(weekStart), pickable: NO_PICKABLE_DAYS };
}

export type CalendarWeek = ReturnType<typeof useCalendarWeek>;
