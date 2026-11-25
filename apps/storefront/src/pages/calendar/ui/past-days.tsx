'use client';

import { useId } from 'react';
import { Button } from '@heroui/react';
import { Check, ChevronDown, Clock } from 'lucide-react';
import { cn, pluralize } from '@ratingo/web-core/lib';
import { interpolate, useTranslation, type Dictionary, type Locale } from '@/shared/i18n';
import { capitalizeFirst } from '@/shared/lib';
import { dayHeadingId, daySectionProps } from '../lib/day-anchor';
import type { CalendarMode } from '../model/calendar-query';
import { formatDay } from '../model/calendar-format';
import { summarizePast, type CalendarDay, type PastSummary } from '../model/week-layout';
import { useCalendarContext } from './calendar-context';
import { DayReleases } from './day-releases';

const PAST_ROW = 'flex h-13 items-center gap-2 px-3.5 text-[15px] font-semibold';

function countedKind(summary: Exclude<PastSummary, { kind: 'allWatched' }>, mode: CalendarMode) {
  return summary.kind === 'episodes' && mode === 'premieres' ? 'premieres' : summary.kind;
}

function pastLabel(
  summary: PastSummary,
  mode: CalendarMode,
  { dict, locale }: { dict: Dictionary; locale: Locale },
): string {
  if (summary.kind === 'allWatched') return dict.calendar.past.allWatched;
  const forms = dict.calendar.past[countedKind(summary, mode)];
  return interpolate(pluralize(summary.count, forms, locale), { count: summary.count });
}

function PastDaySection({ day }: { day: CalendarDay }) {
  const { locale } = useTranslation();
  const headingId = dayHeadingId(day.key);

  return (
    <section
      {...daySectionProps(day.key)}
      aria-labelledby={headingId}
      tabIndex={-1}
      className="border-t border-separator pt-2 outline-none"
    >
      <h3 id={headingId} className="text-[13px] font-semibold text-muted">
        {capitalizeFirst(formatDay(locale, day.key, 'weekdayDayMonth'))}
      </h3>
      <DayReleases day={day} />
    </section>
  );
}

interface PastDaysProps {
  days: CalendarDay[];
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

const PAST_FRAME =
  'mx-4 mt-3.5 rounded-2xl border border-default bg-surface-secondary md:mx-0 md:my-4';

function AllWatchedRow({ label }: { label: string }) {
  return (
    <p className={PAST_ROW}>
      <Clock aria-hidden className="size-4.5 shrink-0 text-muted" />
      <span className="flex-1">{label}</span>
      <Check aria-hidden className="size-4.5 text-success" strokeWidth={2.6} />
    </p>
  );
}

interface PastDaysAccordionProps extends PastDaysProps {
  label: string;
}

function PastDaysAccordion({ days, isOpen, onOpenChange, label }: PastDaysAccordionProps) {
  const panelId = useId();

  return (
    <>
      <Button
        variant="ghost"
        fullWidth
        aria-expanded={isOpen}
        aria-controls={panelId}
        onPress={() => onOpenChange(!isOpen)}
        className={cn(PAST_ROW, 'justify-start rounded-2xl text-foreground')}
      >
        <Clock aria-hidden className="size-4.5 shrink-0 text-muted" />
        <span className="flex-1 text-start">{label}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            'size-4 text-muted transition-transform motion-reduce:transition-none',
            isOpen && 'rotate-180',
          )}
        />
      </Button>
      <div id={panelId} className={cn('flex flex-col gap-3 px-3.5', isOpen && 'pb-2')}>
        {isOpen ? days.map((day) => <PastDaySection key={day.key} day={day} />) : null}
      </div>
    </>
  );
}

export function PastDays(props: PastDaysProps) {
  const translation = useTranslation();
  const { mode } = useCalendarContext();
  const summary = summarizePast(props.days);
  const label = pastLabel(summary, mode, translation);

  return (
    <section className={PAST_FRAME}>
      {summary.kind === 'allWatched' ? (
        <AllWatchedRow label={label} />
      ) : (
        <PastDaysAccordion {...props} label={label} />
      )}
    </section>
  );
}
