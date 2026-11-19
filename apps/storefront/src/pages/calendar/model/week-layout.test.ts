import type { CalendarEpisode, CalendarMovie, CalendarRange } from '@/shared/api';
import {
  calendarEpisode as episode,
  calendarMovie as movie,
  calendarRange as range,
} from './calendar-episode.fixture';
import {
  firstEpisodeFrom,
  pickableDays,
  splitWeek,
  buildStripWeek,
  summarizePast,
  groupByDay,
  type CalendarDay,
} from './week-layout';

function calendarDay(
  key: string,
  episodes: CalendarEpisode[],
  movies: CalendarMovie[] = [],
  moreMovies = 0,
): CalendarDay {
  return { key, episodes, movies, moreMovies };
}

function movieRange(days: CalendarRange['days']): CalendarRange {
  return { ...range([]), days };
}

describe('groupByDay', () => {
  it('buckets episodes by Kyiv day and drops the lead day', () => {
    const sundayNight = episode({ airDate: '2026-11-08T22:30:00.000Z' });
    const lead = episode({ airDate: '2026-11-08T12:00:00.000Z' });
    const days = groupByDay(range([sundayNight, lead]), '2026-11-09');

    expect(days).toHaveLength(7);
    expect(days[0]).toEqual(calendarDay('2026-11-09', [sundayNight]));
    expect(days.flatMap((day) => day.episodes)).not.toContain(lead);
  });

  it('uses Kyiv summer time across the March clock change', () => {
    const mondayAfterChange = episode({ airDate: '2026-03-29T21:30:00.000Z' });
    const sundayBeforeChange = episode({ airDate: '2026-03-29T20:30:00.000Z' });
    const days = groupByDay(range([mondayAfterChange, sundayBeforeChange]), '2026-03-30');

    expect(days[0].episodes).toEqual([mondayAfterChange]);
  });

  it('orders a day by time, then popularity', () => {
    const late = episode({ airDate: '2026-11-12T20:00:00.000Z', showPopularity: 99 });
    const popular = episode({ airDate: '2026-11-12T19:00:00.000Z', showPopularity: 50 });
    const niche = episode({ airDate: '2026-11-12T19:00:00.000Z', showPopularity: 5 });
    const [, , , thursday] = groupByDay(range([late, niche, popular]), '2026-11-09');

    expect(thursday.episodes).toEqual([popular, niche, late]);
  });

  it('puts movies on their API day by popularity and keeps the count of the rest', () => {
    const niche = movie({ popularity: 3 });
    const popular = movie({ popularity: 90 });
    const lead = movie();
    const days = groupByDay(
      movieRange([
        { date: '2026-11-08', episodes: [], movies: [lead], moreMoviesCount: 4 },
        { date: '2026-11-12', episodes: [], movies: [niche, popular], moreMoviesCount: 7 },
      ]),
      '2026-11-09',
    );

    expect(days[3]).toEqual(calendarDay('2026-11-12', [], [popular, niche], 7));
    expect(days.flatMap((day) => day.movies)).not.toContain(lead);
  });
});

describe('summarizePast', () => {
  const day = (episodes: CalendarDay['episodes']): CalendarDay[] => [
    calendarDay('2026-11-10', episodes),
  ];

  it('counts unwatched tracked episodes', () => {
    const summary = summarizePast(
      day([episode({ isTracked: true }), episode({ isTracked: true, isWatched: true }), episode()]),
    );
    expect(summary).toEqual({ kind: 'unwatched', count: 1 });
  });

  it('reports all watched when every episode is tracked and watched', () => {
    expect(summarizePast(day([episode({ isTracked: true, isWatched: true })]))).toEqual({
      kind: 'allWatched',
    });
  });

  it('falls back to the episode count for untracked shows', () => {
    expect(summarizePast(day([episode(), episode()]))).toEqual({ kind: 'episodes', count: 2 });
  });

  it('counts listed and hidden movies on movie days', () => {
    const days = [
      calendarDay('2026-11-10', [], [movie(), movie()], 3),
      calendarDay('2026-11-11', [], [movie()]),
    ];
    expect(summarizePast(days)).toEqual({ kind: 'movies', count: 6 });
  });
});

describe('splitWeek', () => {
  const days: CalendarDay[] = [
    calendarDay('2026-11-09', [episode()]),
    calendarDay('2026-11-10', []),
    calendarDay('2026-11-12', [], [], 2),
    calendarDay('2026-11-15', [], [movie()]),
  ];

  it('collapses days before today and drops empty ones', () => {
    const layout = splitWeek(days, '2026-11-15');
    expect(layout.past.map((day) => day.key)).toEqual(['2026-11-09', '2026-11-12']);
    expect(layout.upcoming.map((day) => day.key)).toEqual(['2026-11-15']);
  });

  it('keeps other weeks expanded', () => {
    expect(splitWeek(days, undefined).past).toEqual([]);
  });
});

describe('pickableDays', () => {
  it('offers past days only while the past block can open', () => {
    const upcoming = calendarDay('2026-11-15', [episode()]);
    const watchedPast = calendarDay('2026-11-10', [episode({ isTracked: true, isWatched: true })]);
    const unwatchedPast = calendarDay('2026-11-11', [episode()]);

    expect([...pickableDays({ past: [watchedPast], upcoming: [upcoming] })]).toEqual([
      '2026-11-15',
    ]);
    expect([...pickableDays({ past: [unwatchedPast], upcoming: [] })]).toEqual(['2026-11-11']);
  });
});

describe('firstEpisodeFrom', () => {
  it('returns the earliest episode on or after the given Kyiv day', () => {
    const before = episode({ airDate: '2026-11-15T12:00:00.000Z' });
    const mondayNight = episode({ airDate: '2026-11-15T22:30:00.000Z' });
    const later = episode({ airDate: '2026-11-20T12:00:00.000Z' });
    expect(firstEpisodeFrom(range([later, before, mondayNight]), '2026-11-16')).toBe(mondayNight);
  });
});

describe('buildStripWeek', () => {
  it('marks the days a neighbour week will let the viewer open', () => {
    const days = groupByDay(
      range([episode({ airDate: '2026-11-18T19:00:00.000Z' })]),
      '2026-11-16',
    );

    expect([...buildStripWeek(days, '2026-11-16', '2026-11-15').pickable]).toEqual(['2026-11-18']);
  });
});
