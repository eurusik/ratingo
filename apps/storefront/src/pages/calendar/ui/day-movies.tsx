'use client';

import { pluralize } from '@ratingo/web-core/lib';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { CalendarDay } from '../model/week-layout';
import { RELEASE_LIST, MORE_MOVIES_TEXT } from './calendar-layout';
import { CalendarMovieItem } from './calendar-movie';

export function DayMovies({ day }: { day: CalendarDay }) {
  const { dict, locale } = useTranslation();

  return (
    <div className="min-w-0">
      {day.movies.length > 0 ? (
        <ul className={RELEASE_LIST}>
          {day.movies.map((movie) => (
            <CalendarMovieItem key={movie.mediaItemId} movie={movie} />
          ))}
        </ul>
      ) : null}
      {day.moreMovies > 0 ? (
        <p className={MORE_MOVIES_TEXT}>
          {interpolate(pluralize(day.moreMovies, dict.calendar.moreMovies, locale), {
            count: day.moreMovies,
          })}
        </p>
      ) : null}
    </div>
  );
}
