'use client';

import { movieCount, type CalendarDay } from '../model/week-layout';
import { DayEpisodes } from './day-episodes';
import { DayMovies } from './day-movies';

export function DayReleases({ day }: { day: CalendarDay }) {
  return (
    <div className="flex min-w-0 flex-col">
      {day.episodes.length > 0 ? <DayEpisodes day={day} /> : null}
      {movieCount(day) > 0 ? <DayMovies day={day} /> : null}
    </div>
  );
}
