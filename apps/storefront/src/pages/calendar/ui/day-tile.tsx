'use client';

import { memo, type MouseEvent } from 'react';
import { cn, pluralize } from '@ratingo/web-core/lib';
import type { CalendarMediaType } from '@/shared/api';
import { interpolate, useTranslation, type Dictionary, type Locale } from '@/shared/i18n';
import { dayAnchor } from '../lib/day-anchor';
import type { DateKey } from '../model/calendar-dates';
import { formatDay } from '../model/calendar-format';
import { movieCount, type CalendarDay } from '../model/week-layout';
import { dayTileHeight } from './calendar-layout';

const MAX_DOTS = 3;

const TILE_FRAME =
  'flex flex-col items-center justify-center gap-1 rounded-2xl no-underline md:gap-0.5 md:border';

const DATE_CIRCLE = 'flex size-10 items-center justify-center rounded-full border md:hidden';

const TILE_FOCUS =
  'outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus';

type TileTone = 'today' | 'active' | 'pickable' | 'empty';

const TONES: Record<TileTone, { circle: string; frame: string }> = {
  today: {
    circle: 'border-accent bg-accent text-accent-foreground',
    frame: 'md:border-accent md:bg-accent md:text-accent-foreground',
  },
  active: {
    circle: 'border-accent bg-accent-soft text-accent-soft-foreground',
    frame: 'md:border-accent md:bg-accent-soft md:text-accent-soft-foreground',
  },
  pickable: {
    circle: 'border-transparent bg-default text-foreground',
    frame: 'md:border-transparent md:bg-default md:text-foreground md:hover:bg-surface-tertiary',
  },
  empty: {
    circle: 'border-separator text-muted',
    frame: 'md:border-separator md:text-muted',
  },
};

interface TileState {
  isToday: boolean;
  isPickable: boolean;
  isActive: boolean;
}

function tileTone({ isToday, isPickable, isActive }: TileState): TileTone {
  if (isToday) return 'today';
  if (isActive) return 'active';
  return isPickable ? 'pickable' : 'empty';
}

interface DayCount {
  type: CalendarMediaType;
  count: number;
}

function dayCount(day: CalendarDay): DayCount {
  const movies = movieCount(day);
  return day.episodes.length === 0 && movies > 0
    ? { type: 'movie', count: movies }
    : { type: 'show', count: day.episodes.length };
}

function countLabel({ type, count }: DayCount, dict: Dictionary, locale: Locale): string {
  const forms = type === 'movie' ? dict.calendar.moviesCount : dict.calendar.episodesCount;
  return interpolate(pluralize(count, forms, locale), { count });
}

function dotKeys(day: CalendarDay): string[] {
  const keys = [
    ...day.episodes.map((episode) => episode.episodeId),
    ...day.movies.map((movie) => movie.mediaItemId),
  ];
  return keys.slice(0, MAX_DOTS);
}

function tileLabel(
  day: CalendarDay,
  type: CalendarMediaType,
  isToday: boolean,
  { dict, locale }: { dict: Dictionary; locale: Locale },
): string {
  const { count, type: countedType } = dayCount(day);
  const weekday = formatDay(locale, day.key, 'weekdayDayMonth');
  const fullDay = isToday ? `${dict.calendar.today}, ${weekday}` : weekday;
  return count > 0
    ? interpolate(pluralize(count, dict.calendar.dayTile[countedType], locale), {
        day: fullDay,
        count,
      })
    : interpolate(dict.calendar.dayTileEmpty[type], { day: fullDay });
}

function ariaCurrent(isToday: boolean, isActive: boolean): 'date' | 'true' | undefined {
  if (isToday) return 'date';
  return isActive ? 'true' : undefined;
}

interface DesktopTileContentProps {
  day: CalendarDay;
  isToday: boolean;
  isCompact: boolean;
}

interface PhoneTileContentProps extends DesktopTileContentProps {
  tone: TileTone;
}

function PhoneTileContent({ day, tone, isToday, isCompact }: PhoneTileContentProps) {
  const { locale } = useTranslation();

  return (
    <>
      <span
        className={cn(
          'text-xs font-semibold md:hidden',
          isToday ? 'text-accent' : 'text-muted',
          isCompact && 'hidden',
        )}
      >
        {formatDay(locale, day.key, 'weekdayShort')}
      </span>
      <span className={cn(DATE_CIRCLE, TONES[tone].circle)}>
        <span className="text-lg leading-none font-extrabold tabular-nums">
          {formatDay(locale, day.key, 'dayNumber')}
        </span>
      </span>
      <span className="flex h-1.25 gap-0.75 md:hidden">
        {dotKeys(day).map((key) => (
          <span key={key} className="size-1.25 rounded-full bg-accent" />
        ))}
      </span>
    </>
  );
}

function DesktopTileContent({ day, isToday, isCompact }: DesktopTileContentProps) {
  const { dict, locale } = useTranslation();
  const counted = dayCount(day);

  return (
    <>
      <span className="hidden items-baseline gap-1.5 md:flex">
        <span className="text-xl leading-none font-extrabold tabular-nums">
          {formatDay(locale, day.key, 'dayNumber')}
        </span>
        <span className="text-sm font-semibold">{formatDay(locale, day.key, 'weekdayShort')}</span>
      </span>
      {counted.count > 0 && !isCompact ? (
        <span
          className={cn(
            'hidden text-xs tabular-nums md:block',
            isToday ? 'text-accent-foreground' : 'text-muted',
          )}
        >
          {countLabel(counted, dict, locale)}
        </span>
      ) : null}
    </>
  );
}

interface DayTileProps extends Omit<TileState, 'isToday'> {
  day: CalendarDay;
  type: CalendarMediaType;
  today: DateKey;
  isCompact: boolean;
  onPick?: (key: DateKey) => void;
}

export const DayTile = memo(function DayTile({
  day,
  type,
  today,
  isPickable,
  isActive,
  isCompact,
  onPick,
}: DayTileProps) {
  const translation = useTranslation();
  const isToday = day.key === today;
  const tone = tileTone({ isToday, isPickable, isActive });
  const label = tileLabel(day, type, isToday, translation);
  const className = cn(TILE_FRAME, dayTileHeight(isCompact), TONES[tone].frame);
  const content = (
    <span aria-hidden className="contents">
      <PhoneTileContent day={day} tone={tone} isToday={isToday} isCompact={isCompact} />
      <DesktopTileContent day={day} isToday={isToday} isCompact={isCompact} />
    </span>
  );

  if (!isPickable || !onPick) {
    return (
      <div role="img" aria-label={label} className={className}>
        {content}
      </div>
    );
  }

  const pick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onPick(day.key);
  };

  return (
    <a
      href={`#${dayAnchor(day.key)}`}
      onClick={pick}
      aria-label={label}
      aria-current={ariaCurrent(isToday, isActive)}
      className={cn(className, TILE_FOCUS)}
    >
      {content}
    </a>
  );
});
