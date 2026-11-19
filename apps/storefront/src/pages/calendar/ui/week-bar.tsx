'use client';

import { useCallback, type RefObject } from 'react';
import { cn } from '@ratingo/web-core/lib';
import { useIsStuck } from '../lib/use-is-stuck';
import { usePinnedDay } from '../lib/use-pinned-day';
import { useVisibleDay } from '../lib/use-visible-day';
import { useLatestCallback } from '../lib/use-latest-callback';
import { CURRENT_PANE, useWeekCarousel, type WeekStep } from '../lib/use-week-carousel';
import { addDays, weeksFromToday, WEEK_LENGTH, type DateKey } from '../model/calendar-dates';
import type { StripWeek } from '../model/week-layout';
import { WEEK_BAR_FRAME, WEEK_BAR_STICKY, WEEK_BAR_STUCK_GAP } from './calendar-layout';
import type { ModePillsProps } from './mode-pills';
import { WeekHeader } from './week-header';
import { WeekStrip } from './week-strip';

interface WeekBarProps extends ModePillsProps {
  weekStart: DateKey;
  today: DateKey;
  stripWeeks?: StripWeek[];
  list: RefObject<HTMLElement | null>;
  tryStep: (step: WeekStep, action?: 'swipe') => boolean;
  onThisWeek: () => void;
  onDayPick: (key: DateKey) => void;
}

export function WeekBar({
  weekStart,
  today,
  stripWeeks,
  list,
  tryStep,
  onThisWeek,
  onDayPick,
  type,
  mode,
  onModeChange,
}: WeekBarProps) {
  const { sentinel, sticky, isStuck } = useIsStuck<HTMLDivElement>();
  const visibleDay = useVisibleDay(list, sticky);
  const [pinnedDay, pinDay] = usePinnedDay(weekStart);
  const { scroller, previewStep, slideTo } = useWeekCarousel(weekStart, tryStep);

  const pickDay = useCallback(
    (key: DateKey) => {
      pinDay(key);
      onDayPick(key);
    },
    [pinDay, onDayPick],
  );

  const currentWeek = stripWeeks?.[CURRENT_PANE];
  const goToToday = useLatestCallback(() => {
    const weeksAway = weeksFromToday(today, weekStart);
    if (weeksAway === 0) {
      if (currentWeek?.pickable.has(today)) pickDay(today);
    } else if (Math.abs(weeksAway) === 1) slideTo(weeksAway > 0 ? -1 : 1);
    else onThisWeek();
  });
  const changeMode = useLatestCallback(onModeChange);

  return (
    <>
      <div ref={sentinel} aria-hidden />
      <div
        ref={sticky}
        data-top-bar
        className={cn(WEEK_BAR_FRAME, WEEK_BAR_STICKY, isStuck && WEEK_BAR_STUCK_GAP)}
      >
        <WeekHeader
          shownWeekStart={addDays(weekStart, previewStep * WEEK_LENGTH)}
          committedWeekStart={weekStart}
          today={today}
          onStep={slideTo}
          onToday={goToToday}
          type={type}
          mode={mode}
          onModeChange={changeMode}
        />
        <WeekStrip
          scroller={scroller}
          stripWeeks={stripWeeks}
          type={type}
          today={today}
          activeDay={pinnedDay ?? visibleDay}
          isCompact={isStuck}
          onDayPick={pickDay}
          onNeighbourPick={slideTo}
        />
      </div>
    </>
  );
}
