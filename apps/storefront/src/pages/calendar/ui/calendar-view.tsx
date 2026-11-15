'use client';

import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from '@/shared/i18n';
import { useClientNow } from '@/shared/lib';
import { useRememberedFlag } from '../lib/remembered-flag';
import { dayAnchor } from '../lib/day-anchor';
import { revealSection } from '../lib/reveal-section';
import { useCalendarNavigation } from '../lib/use-calendar-navigation';
import { usePageMarker } from '../lib/use-page-marker';
import type { DateKey } from '../model/calendar-dates';
import { useCalendarLocation } from '../model/use-calendar-location';
import { useClientToday } from '../model/use-client-today';
import { useCalendarWeek, type CalendarWeek } from '../model/use-calendar-week';
import { useStartWatching } from '../model/use-start-watching';
import { CalendarDaySection } from './calendar-day';
import { CalendarProvider } from './calendar-context';
import { CalendarHeader } from './calendar-header';
import { CALENDAR_LIST, CALENDAR_ROOT, NOTICE_AREA, STATUS_BAR_BACKDROP } from './calendar-layout';
import {
  CalendarError,
  EmptyWeekNote,
  GuestPrompt,
  NoShowsPrompt,
  RestWeekNote,
} from './calendar-notices';
import { CalendarListSkeleton } from './calendar-skeleton';
import { PastDays } from './past-days';
import { WeekBar } from './week-bar';
import './calendar-page.css';

interface NoticeActions {
  onShowAll: () => void;
  onNextWeek: () => void;
}

function weekNotice(week: CalendarWeek, { onShowAll, onNextWeek }: NoticeActions): ReactNode {
  if (week.isGuestInMine) return <GuestPrompt onShowAll={onShowAll} />;
  if (!week.layout && week.active.isError) {
    return <CalendarError onRetry={() => void week.active.refetch()} />;
  }
  if (!week.layout) return null;
  if (week.isResting) return <RestWeekNote upcoming={week.nextEpisode} onNextWeek={onNextWeek} />;
  if (!week.isEmptyWeek) return null;
  return week.mode === 'mine' ? <NoShowsPrompt onShowAll={onShowAll} /> : <EmptyWeekNote />;
}

interface CalendarBodyProps {
  week: CalendarWeek;
  today: DateKey;
  isPastOpen: boolean;
  onPastOpenChange: (isOpen: boolean) => void;
  onShowAll: () => void;
  onNextWeek: () => void;
  onStarted: () => void;
}

function CalendarBody({
  week,
  today,
  isPastOpen,
  onPastOpenChange,
  onShowAll,
  onNextWeek,
  onStarted,
}: CalendarBodyProps) {
  const { dict } = useTranslation();
  const now = useClientNow();
  const { start, pendingShowId } = useStartWatching(onStarted);
  const { mode, layout, viewer } = week;
  const context = useMemo(
    () => (mode ? { mode, now, viewer, start, pendingShowId } : undefined),
    [mode, now, viewer, start, pendingShowId],
  );

  const notice = weekNotice(week, { onShowAll, onNextWeek });
  if (notice) return <div className={NOTICE_AREA}>{notice}</div>;
  if (!layout || !context) return <CalendarListSkeleton label={dict.common.loading} />;

  return (
    <CalendarProvider value={context}>
      {layout.past.length > 0 ? (
        <PastDays days={layout.past} isOpen={isPastOpen} onOpenChange={onPastOpenChange} />
      ) : null}
      {layout.upcoming.map((day) => (
        <CalendarDaySection key={day.key} day={day} today={today} />
      ))}
    </CalendarProvider>
  );
}

const PAST_DAYS_OPEN_BY_DEFAULT = true;

function pastDaysFlagKey(weekStart: DateKey): string {
  return `${weekStart}:past-days`;
}

export function CalendarView({ today: serverToday }: { today: DateKey }) {
  const today = useClientToday(serverToday);
  usePageMarker('data-calendar-page');
  const list = useRef<HTMLDivElement>(null);
  const [location, setLocation] = useCalendarLocation(today);
  const { weekStart } = location;
  const [isPastOpen, setPastOpen] = useRememberedFlag(
    pastDaysFlagKey(weekStart),
    PAST_DAYS_OPEN_BY_DEFAULT,
  );
  const week = useCalendarWeek({ location, today });
  const pastDays = week.layout?.past;
  const pastKeys = useMemo(() => new Set(pastDays?.map((day) => day.key)), [pastDays]);

  const navigation = useCalendarNavigation({
    location,
    resolvedMode: week.mode,
    today,
    list,
    setLocation,
  });

  const pickDay = useCallback(
    (key: DateKey) => {
      if (pastKeys.has(key)) flushSync(() => setPastOpen(true));
      revealSection(dayAnchor(key));
    },
    [pastKeys, setPastOpen],
  );

  return (
    <div data-calendar-root className={CALENDAR_ROOT}>
      <div aria-hidden className={STATUS_BAR_BACKDROP} />
      <CalendarHeader mode={week.mode} onModeChange={navigation.changeMode} />
      <WeekBar
        weekStart={weekStart}
        today={today}
        stripWeeks={week.stripWeeks}
        list={list}
        tryStep={navigation.tryStep}
        mode={week.mode}
        onModeChange={navigation.changeMode}
        onThisWeek={navigation.goToThisWeek}
        onDayPick={pickDay}
      />
      <div ref={list} aria-busy={week.active.isFetching} className={CALENDAR_LIST}>
        <div key={`${weekStart}:${week.mode}`} data-calendar-list-swap className={CALENDAR_LIST}>
          <CalendarBody
            week={week}
            today={today}
            isPastOpen={isPastOpen}
            onPastOpenChange={setPastOpen}
            onShowAll={() => navigation.changeMode('all')}
            onNextWeek={navigation.goToNextWeek}
            onStarted={navigation.keepResolvedMode}
          />
        </div>
      </div>
    </div>
  );
}
