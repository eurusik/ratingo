'use client';

import { memo } from 'react';
import { cn } from '@ratingo/web-core/lib';
import { useTranslation, type Dictionary, type Locale } from '@/shared/i18n';
import { capitalizeFirst } from '@/shared/lib';
import { dayHeadingId, daySectionProps } from '../lib/day-anchor';
import { addDays, type DateKey } from '../model/calendar-dates';
import { formatDay } from '../model/calendar-format';
import type { CalendarDay } from '../model/week-layout';
import { DAY_HEADING_TEXT, DAY_SECTION } from './calendar-layout';
import { DayReleases } from './day-releases';

function dayTitle(key: DateKey, today: DateKey, dict: Dictionary, locale: Locale): string {
  if (key === today) return dict.calendar.today;
  if (key === addDays(today, 1)) return dict.calendar.tomorrow;
  return capitalizeFirst(formatDay(locale, key, 'weekdayLong'));
}

export const CalendarDaySection = memo(function CalendarDaySection({
  day,
  today,
}: {
  day: CalendarDay;
  today: DateKey;
}) {
  const { dict, locale } = useTranslation();
  const headingId = dayHeadingId(day.key);

  return (
    <section
      {...daySectionProps(day.key)}
      aria-labelledby={headingId}
      tabIndex={-1}
      className={cn(DAY_SECTION, 'outline-none')}
    >
      <h3
        id={headingId}
        className={cn(
          DAY_HEADING_TEXT,
          'mb-2 flex items-baseline gap-2 md:mb-0 md:flex-col md:gap-0.5',
        )}
      >
        <span className={cn(day.key === today && 'text-accent')}>
          {dayTitle(day.key, today, dict, locale)}
        </span>
        <span className="text-[13px] font-semibold text-muted md:text-sm">
          {formatDay(locale, day.key, 'dayMonth')}
        </span>
      </h3>
      <DayReleases day={day} />
    </section>
  );
});
