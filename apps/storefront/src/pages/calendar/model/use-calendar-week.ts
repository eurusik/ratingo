'use client';

import { useMemo } from 'react';
import { useAuth } from '@ratingo/web-core/auth';
import type { CalendarMediaType, CalendarRange, CalendarRangeQuery } from '@/shared/api';
import { addDays, WEEK_LENGTH, type DateKey } from './calendar-dates';
import { hasTrackedShows } from './calendar-range';
import {
  rangeFiltersFor,
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
  groupByDay,
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

function weekQuery(
  weekStart: DateKey,
  mode: CalendarMode,
  type: CalendarMediaType,
): CalendarRangeQuery {
  return { ...weekRequest(weekStart), ...rangeFiltersFor(mode), type };
}

function useActiveRange({ weekStart, type, mode: requested }: CalendarLocation) {
  const personalized = useCalendarRange({
    query: weekQuery(weekStart, 'mine', type),
    isEnabled: type === 'show' || requested === 'mine',
  });
  const mode = useCalendarMode({ requested, personalized, type });
  const everyone = useCalendarRange({
    query: weekQuery(weekStart, 'all', type),
    isEnabled: mode !== undefined,
  });
  const premieres = useCalendarRange({
    query: weekQuery(weekStart, 'premieres', type),
    isEnabled: mode === 'premieres',
  });
  const byMode = { mine: personalized, premieres, all: everyone };
  return { mode, active: mode ? byMode[mode] : everyone };
}

function likelyMode(mode: CalendarMode | undefined, viewer: ViewerStatus) {
  if (mode) return mode;
  return viewer === 'signedIn' ? 'mine' : undefined;
}

export function useCalendarWeek({ location, today }: CalendarWeekInputs) {
  const viewer = useViewerStatus();
  const { weekStart, type } = location;
  const { mode, active } = useActiveRange(location);
  const isGuestInMine = mode === 'mine' && viewer === 'guest';

  const days = useMemo(() => {
    if (active.data) return groupByDay(active.data, weekStart);
    return isGuestInMine ? emptyCalendarDays(weekStart) : undefined;
  }, [active.data, isGuestInMine, weekStart]);
  const layout = useMemo(
    () => (days ? weekLayoutFor(days, weekStart, today) : undefined),
    [days, weekStart, today],
  );
  const isEmptyWeek = layout ? layout.past.length + layout.upcoming.length === 0 : false;
  const isResting = mode === 'mine' && isEmptyWeek && hasTrackedShows(active.data);
  const isPremiereFree =
    mode === 'premieres' && layout !== undefined && layout.upcoming.length === 0;

  const currentStripWeek = useMemo(() => {
    const stripDays = days ?? (active.isError ? emptyCalendarDays(weekStart) : undefined);
    return stripDays && buildStripWeek(stripDays, weekStart, today, mode);
  }, [days, active.isError, weekStart, today, mode]);
  const stripWeeks = useStripWeeks({
    weekStart,
    today,
    current: currentStripWeek,
    mode: likelyMode(mode, viewer),
    type,
    isEnabled: viewer !== 'resolving',
  });
  const nextEpisode = useFirstEpisodeAfter(weekStart, { mode: 'mine', isEnabled: isResting });
  const nextPremiere = useFirstEpisodeAfter(weekStart, {
    mode: 'premieres',
    isEnabled: isPremiereFree,
  });

  return {
    mode,
    type,
    viewer,
    active,
    layout,
    stripWeeks,
    isGuestInMine,
    isEmptyWeek,
    isResting,
    isPremiereFree,
    nextEpisode,
    nextPremiere,
  };
}

interface LookaheadInputs {
  mode: CalendarMode;
  isEnabled: boolean;
}

function useFirstEpisodeAfter(weekStart: DateKey, { mode, isEnabled }: LookaheadInputs) {
  const nextWeekStart = addDays(weekStart, WEEK_LENGTH);
  const upcoming = useCalendarRange({
    query: { ...upcomingRequest(nextWeekStart), ...rangeFiltersFor(mode), type: 'show' },
    isEnabled,
  });
  return isEnabled ? firstEpisodeFrom(upcoming.data, nextWeekStart) : undefined;
}

interface NeighbourInputs {
  today: DateKey;
  mode: CalendarMode | undefined;
  type: CalendarMediaType;
  isEnabled: boolean;
}

interface StripWeeksInputs extends NeighbourInputs {
  weekStart: DateKey;
  current: StripWeek | undefined;
}

const OTHER_MODE = { mine: 'all', premieres: 'all', all: 'mine' } as const satisfies Record<
  CalendarMode,
  CalendarMode
>;

type WarmNeighbourInputs = Omit<NeighbourInputs, 'today'>;

function useWarmNeighbour(weekStart: DateKey, { mode, type, isEnabled }: WarmNeighbourInputs) {
  useCalendarRange({
    query: weekQuery(weekStart, mode ?? 'all', type),
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
  const warm = { mode: otherMode, type: neighbours.type, isEnabled: isReadyToWarm };
  useWarmNeighbour(previousWeekStart, warm);
  useWarmNeighbour(nextWeekStart, warm);
  return useMemo(
    () => (current ? [previous, current, next] : undefined),
    [previous, current, next],
  );
}

function useNeighbourWeek(
  weekStart: DateKey,
  { today, mode, type, isEnabled }: NeighbourInputs,
): StripWeek {
  const { data } = useCalendarRange({
    query: weekQuery(weekStart, mode ?? 'all', type),
    isEnabled: isEnabled && mode !== undefined,
  });
  return useMemo(
    () => neighbourWeek(data, weekStart, { today, mode }),
    [data, weekStart, today, mode],
  );
}

function neighbourWeek(
  data: CalendarRange | undefined,
  weekStart: DateKey,
  { today, mode }: Pick<NeighbourInputs, 'today' | 'mode'>,
): StripWeek {
  return data
    ? buildStripWeek(groupByDay(data, weekStart), weekStart, today, mode)
    : { days: emptyCalendarDays(weekStart), pickable: NO_PICKABLE_DAYS };
}

export type CalendarWeek = ReturnType<typeof useCalendarWeek>;
