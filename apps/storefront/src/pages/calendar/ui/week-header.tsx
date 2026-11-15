'use client';

import { memo, useRef, type RefObject } from 'react';
import { Button } from '@heroui/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@ratingo/web-core/lib';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { WeekStep } from '../lib/use-week-carousel';
import { weeksFromToday, type DateKey } from '../model/calendar-dates';
import {
  formatDay,
  formatWeekMonths,
  formatWeekSpan,
  formatWeeksAway,
} from '../model/calendar-format';
import {
  DESKTOP_TODAY_BUTTON,
  PHONE_ARROWS_OVERLAY,
  PHONE_MONTH_LABEL,
  TODAY_ICON_BUTTON,
  TODAY_ICON_FRAME,
  WEEK_ARROW_SIZE,
  WEEK_HEADER_ROW,
  WEEK_SPAN_TEXT,
  WEEK_TITLE_TEXT,
} from './calendar-layout';
import { ModePills, type ModePillsProps } from './mode-pills';

const WEEK_NAMES = { '-1': 'previous', '0': 'current', '1': 'next' } as const;

const ARROW_ICONS = { [-1]: ChevronLeft, 1: ChevronRight } as const;

function isAdjacentWeek(weeksAway: number): weeksAway is -1 | 0 | 1 {
  return Math.abs(weeksAway) <= 1;
}

function useWeekTitle(weekStart: DateKey, today: DateKey): string {
  const { dict, locale } = useTranslation();
  const weeksAway = weeksFromToday(today, weekStart);
  return isAdjacentWeek(weeksAway)
    ? dict.calendar.weekNames[WEEK_NAMES[weeksAway]]
    : formatWeeksAway(locale, weeksAway);
}

interface WeekTitleProps {
  shownWeekStart: DateKey;
  committedWeekStart: DateKey;
  today: DateKey;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

function WeekTitle({ shownWeekStart, committedWeekStart, today, headingRef }: WeekTitleProps) {
  const { dict, locale } = useTranslation();
  const title = useWeekTitle(shownWeekStart, today);

  return (
    <div className="max-md:sr-only md:min-w-0 md:flex-1">
      <h2 ref={headingRef} tabIndex={-1} className={cn(WEEK_TITLE_TEXT, 'outline-none')}>
        {title}
      </h2>
      <p aria-hidden className={WEEK_SPAN_TEXT}>
        {formatWeekSpan(locale, shownWeekStart)}
      </p>
      <p role="status" className="sr-only">
        {interpolate(dict.calendar.weekShown, {
          range: formatWeekSpan(locale, committedWeekStart),
        })}
      </p>
    </div>
  );
}

interface WeekArrowProps {
  direction: WeekStep;
  onStep: (step: WeekStep) => void;
}

function WeekArrow({ direction, onStep }: WeekArrowProps) {
  const { dict } = useTranslation();
  const Icon = ARROW_ICONS[direction];

  return (
    <Button
      isIconOnly
      size="sm"
      variant="tertiary"
      aria-label={direction < 0 ? dict.calendar.prevWeek : dict.calendar.nextWeek}
      onPress={() => onStep(direction)}
      className={cn('max-md:not-focus-visible:sr-only', WEEK_ARROW_SIZE)}
    >
      <Icon aria-hidden className="size-4" />
    </Button>
  );
}

interface PhoneTodayControlsProps {
  shownWeekStart: DateKey;
  today: DateKey;
  isAway: boolean;
  onToday: () => void;
}

function PhoneTodayControls({ shownWeekStart, today, isAway, onToday }: PhoneTodayControlsProps) {
  const { dict, locale } = useTranslation();
  const dayNumber = formatDay(locale, today, 'dayNumber');

  return (
    <>
      <span aria-hidden className={PHONE_MONTH_LABEL}>
        {formatWeekMonths(locale, shownWeekStart)}
      </span>
      <Button
        isIconOnly
        variant="ghost"
        aria-label={`${dict.calendar.today}, ${dayNumber}`}
        onPress={onToday}
        className={TODAY_ICON_BUTTON}
      >
        <span
          aria-hidden
          className={cn(
            TODAY_ICON_FRAME,
            isAway
              ? 'border-accent text-accent before:bg-accent'
              : 'border-separator text-muted before:bg-separator',
          )}
        >
          {dayNumber}
        </span>
      </Button>
    </>
  );
}

interface WeekHeaderProps extends ModePillsProps {
  shownWeekStart: DateKey;
  committedWeekStart: DateKey;
  today: DateKey;
  onStep: (step: WeekStep) => void;
  onToday: () => void;
}

export const WeekHeader = memo(function WeekHeader({
  shownWeekStart,
  committedWeekStart,
  today,
  onStep,
  onToday,
  ...modePillsProps
}: WeekHeaderProps) {
  const { dict } = useTranslation();
  const heading = useRef<HTMLHeadingElement>(null);
  const isAway = weeksFromToday(today, committedWeekStart) !== 0;

  const backToTodayFromDesktop = () => {
    heading.current?.focus();
    onToday();
  };

  return (
    <div className={WEEK_HEADER_ROW}>
      <WeekTitle
        shownWeekStart={shownWeekStart}
        committedWeekStart={committedWeekStart}
        today={today}
        headingRef={heading}
      />
      <ModePills {...modePillsProps} className="md:hidden" />
      <PhoneTodayControls
        shownWeekStart={shownWeekStart}
        today={today}
        isAway={isAway}
        onToday={onToday}
      />
      {isAway ? (
        <Button
          variant="tertiary"
          onPress={backToTodayFromDesktop}
          className={DESKTOP_TODAY_BUTTON}
        >
          {dict.calendar.today}
        </Button>
      ) : null}
      <span className={PHONE_ARROWS_OVERLAY}>
        <WeekArrow direction={-1} onStep={onStep} />
        <WeekArrow direction={1} onStep={onStep} />
      </span>
    </div>
  );
});
