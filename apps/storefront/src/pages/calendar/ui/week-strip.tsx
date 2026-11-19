'use client';

import type { RefObject } from 'react';
import type { CalendarMediaType } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { EdgeFade } from '@/shared/ui';
import { WEEK_PANES, type WeekStep } from '../lib/use-week-carousel';
import type { DateKey } from '../model/calendar-dates';
import type { StripWeek } from '../model/week-layout';
import { DAY_STRIP, WEEK_STRIP_PANE, WEEK_STRIP_SCROLLER } from './calendar-layout';
import { WeekStripSkeleton } from './calendar-skeleton';
import { DayTile } from './day-tile';

interface StripPaneProps {
  week?: StripWeek;
  step: WeekStep | 0;
  type: CalendarMediaType;
  today: DateKey;
  activeDay?: DateKey;
  isCompact: boolean;
  onDayPick: (key: DateKey) => void;
  onNeighbourPick: (step: WeekStep) => void;
}

function StripPane({
  week,
  step,
  type,
  today,
  activeDay,
  isCompact,
  onDayPick,
  onNeighbourPick,
}: StripPaneProps) {
  const isCurrent = step === 0;

  return (
    <div aria-hidden={isCurrent ? undefined : true} className={WEEK_STRIP_PANE}>
      {week ? (
        <div className={DAY_STRIP}>
          {week.days.map((day) => (
            <DayTile
              key={day.key}
              day={day}
              type={type}
              today={today}
              isPickable={week.pickable.has(day.key)}
              isActive={isCurrent && day.key === activeDay}
              isCompact={isCompact}
              onPick={isCurrent ? onDayPick : undefined}
            />
          ))}
        </div>
      ) : (
        <WeekStripSkeleton isCompact={isCompact} />
      )}
      {step === 0 ? null : (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => onNeighbourPick(step)}
          className="absolute inset-0 cursor-pointer touch-manipulation"
        />
      )}
    </div>
  );
}

const PANE_STEPS: Record<(typeof WEEK_PANES)[number], WeekStep | 0> = {
  previous: -1,
  current: 0,
  next: 1,
};

interface WeekStripProps {
  scroller: RefObject<HTMLDivElement | null>;
  stripWeeks?: StripWeek[];
  type: CalendarMediaType;
  today: DateKey;
  activeDay?: DateKey;
  isCompact: boolean;
  onDayPick: (key: DateKey) => void;
  onNeighbourPick: (step: WeekStep) => void;
}

export function WeekStrip({ scroller, stripWeeks, ...paneProps }: WeekStripProps) {
  const { dict } = useTranslation();

  return (
    <div className="relative">
      <div
        ref={scroller}
        role="group"
        aria-label={dict.calendar.daysLabel}
        className={WEEK_STRIP_SCROLLER}
      >
        {WEEK_PANES.map((paneName, paneIndex) => (
          <StripPane
            key={paneName}
            week={stripWeeks?.[paneIndex]}
            step={PANE_STEPS[paneName]}
            {...paneProps}
          />
        ))}
      </div>
      <span className="md:hidden">
        <EdgeFade side="start" isVisible />
        <EdgeFade side="end" isVisible />
      </span>
    </div>
  );
}
