'use client';

import { memo } from 'react';
import { MediaPoster } from '@/entities/media';
import { ReminderToggle } from '@/features/media-reminder';
import type { CalendarMovie } from '@/shared/api';
import { mediaRoute } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { ForwardLink } from '@/shared/ui';
import { useCalendarContext } from './calendar-context';
import { RELEASE_ROW } from './calendar-layout';

export const CalendarMovieItem = memo(function CalendarMovieItem({
  movie,
}: {
  movie: CalendarMovie;
}) {
  const { dict } = useTranslation();
  const { now } = useCalendarContext();
  const line = dict.release[movie.releaseDateKind];
  const subtitle = movie.isSavedForLater ? `${line} · ${dict.calendar.savedNote}` : line;
  const isComingOut = Date.parse(movie.releaseDate) > now;

  return (
    <li className={RELEASE_ROW}>
      <ForwardLink
        href={mediaRoute('movie', movie.slug)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-foreground no-underline outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <MediaPoster type="movie" posterUrl={movie.poster?.small} size="row" />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[15px] font-bold">{movie.title}</span>
          <span className="truncate text-[13px] text-muted">{subtitle}</span>
        </span>
      </ForwardLink>
      {isComingOut ? (
        <ReminderToggle
          media={{
            mediaItemId: movie.mediaItemId,
            title: movie.title,
            isReminderSet: movie.isReminderSet,
          }}
          trigger="release"
        />
      ) : null}
    </li>
  );
});
