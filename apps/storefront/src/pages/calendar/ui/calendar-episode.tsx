'use client';

import { memo } from 'react';
import { Button, Checkbox } from '@heroui/react';
import { Plus } from 'lucide-react';
import { cn } from '@ratingo/web-core/lib';
import { EpisodeStill } from '@/entities/episode';
import { ReminderToggle } from '@/features/media-reminder';
import { SaveButton } from '@/features/save-to-library';
import type { CalendarEpisode } from '@/shared/api';
import { showSeasonRoute } from '@/shared/config';
import { interpolate, useTranslation, type Dictionary } from '@/shared/i18n';
import { ForwardLink } from '@/shared/ui';
import { episodeAction, episodeMark, type EpisodeMark } from '../model/day-plan';
import { calendarEpisodeCode, episodeLine } from '../model/episode-line';
import { useEpisodeWatchToggle } from '../model/use-episode-watch-toggle';
import { useCalendarContext } from './calendar-context';
import { RELEASE_ROW } from './calendar-layout';

const MARK_CLASS: Record<EpisodeMark, string> = {
  newSeries: 'bg-accent text-accent-foreground',
  newSeason: 'bg-foreground text-background',
  finale: 'bg-warning text-warning-foreground',
};

function markLabel(mark: EpisodeMark, episode: CalendarEpisode, dict: Dictionary): string {
  if (mark === 'newSeason') {
    return interpolate(dict.calendar.newSeason, { season: episode.seasonNumber });
  }
  return dict.calendar[mark];
}

function EpisodeMarkBadge({ mark, episode }: { mark: EpisodeMark; episode: CalendarEpisode }) {
  const { dict } = useTranslation();

  return (
    <span
      className={cn(
        'absolute start-1.5 top-1.5 inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-extrabold uppercase',
        MARK_CLASS[mark],
      )}
    >
      {markLabel(mark, episode, dict)}
    </span>
  );
}

function WatchCheckbox({ episode }: { episode: CalendarEpisode }) {
  const { dict } = useTranslation();
  const toggle = useEpisodeWatchToggle(episode);
  const label = interpolate(dict.calendar.markWatched, {
    show: episode.showTitle,
    code: calendarEpisodeCode(episode, dict),
  });

  return (
    <Checkbox
      aria-label={label}
      isSelected={episode.isWatched}
      onChange={toggle}
      className="shrink-0 [&_[data-slot='checkbox-default-indicator--checkmark']]:size-5"
    >
      <Checkbox.Content className="flex size-11 cursor-pointer items-center justify-center select-none">
        <Checkbox.Control className="size-11 shrink-0 rounded-full border-2 border-muted bg-transparent before:rounded-full in-data-[selected=true]:border-accent">
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
}

function StartWatchingButton({ episode }: { episode: CalendarEpisode }) {
  const { dict } = useTranslation();
  const { start, pendingShowId } = useCalendarContext();

  return (
    <Button
      isIconOnly
      variant="outline"
      aria-label={interpolate(dict.calendar.startWatchingLabel, { show: episode.showTitle })}
      isPending={pendingShowId === episode.showId}
      onPress={() => start(episode)}
      className="size-11 shrink-0 rounded-full"
    >
      <Plus aria-hidden className="size-4.5" strokeWidth={2.4} />
    </Button>
  );
}

function showHref(episode: CalendarEpisode): string {
  return episode.isTracked
    ? showSeasonRoute(episode.showSlug, episode.seasonNumber)
    : showSeasonRoute(episode.showSlug);
}

export const CalendarEpisodeItem = memo(function CalendarEpisodeItem({
  episode,
}: {
  episode: CalendarEpisode;
}) {
  const { dict, locale } = useTranslation();
  const { mode, now, viewer } = useCalendarContext();
  const mark = episodeMark(episode);
  const action = episodeAction(episode, { mode, now, viewer });
  const line = episodeLine(episode, dict, locale);

  return (
    <li className={RELEASE_ROW}>
      <ForwardLink
        href={showHref(episode)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-foreground no-underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <span className="relative flex shrink-0">
          <EpisodeStill
            episode={{
              seasonNumber: episode.seasonNumber,
              number: episode.episodeNumber,
              stillPath: episode.stillPath ?? undefined,
            }}
            badge={calendarEpisodeCode(episode, dict)}
            size="row"
            isDimmed={episode.isWatched}
            fallbackPosterPath={episode.posterPath ?? undefined}
          />
          {mark ? <EpisodeMarkBadge mark={mark} episode={episode} /> : null}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={cn('truncate text-[15px] font-bold', episode.isWatched && 'text-muted')}>
            {episode.showTitle}
          </span>
          {line ? (
            <span className="truncate text-[13px] text-muted tabular-nums">{line}</span>
          ) : null}
        </span>
      </ForwardLink>
      {action === 'watch' ? <WatchCheckbox episode={episode} /> : null}
      {action === 'remind' ? (
        <ReminderToggle media={{ mediaItemId: episode.showId, title: episode.showTitle }} />
      ) : null}
      {action === 'start' ? <StartWatchingButton episode={episode} /> : null}
      {action === 'save' ? (
        <SaveButton
          media={{
            mediaItemId: episode.showId,
            title: episode.showTitle,
            slug: episode.showSlug,
            type: 'show',
          }}
        />
      ) : null}
    </li>
  );
});
