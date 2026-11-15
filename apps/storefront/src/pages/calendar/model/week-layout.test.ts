import { calendarEpisode as episode, calendarRange as range } from './calendar-episode.fixture';
import {
  firstEpisodeFrom,
  pickableDays,
  splitWeek,
  buildStripWeek,
  summarizePast,
  groupEpisodesByDay,
  type CalendarDay,
} from './week-layout';

describe('groupEpisodesByDay', () => {
  it('buckets episodes by Kyiv day and drops the lead day', () => {
    const sundayNight = episode({ airDate: '2026-11-08T22:30:00.000Z' });
    const lead = episode({ airDate: '2026-11-08T12:00:00.000Z' });
    const days = groupEpisodesByDay(range([sundayNight, lead]), '2026-11-09');

    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ key: '2026-11-09', episodes: [sundayNight] });
    expect(days.flatMap((day) => day.episodes)).not.toContain(lead);
  });

  it('uses Kyiv summer time across the March clock change', () => {
    const mondayAfterChange = episode({ airDate: '2026-03-29T21:30:00.000Z' });
    const sundayBeforeChange = episode({ airDate: '2026-03-29T20:30:00.000Z' });
    const days = groupEpisodesByDay(range([mondayAfterChange, sundayBeforeChange]), '2026-03-30');

    expect(days[0].episodes).toEqual([mondayAfterChange]);
  });

  it('orders a day by time, then popularity', () => {
    const late = episode({ airDate: '2026-11-12T20:00:00.000Z', showPopularity: 99 });
    const popular = episode({ airDate: '2026-11-12T19:00:00.000Z', showPopularity: 50 });
    const niche = episode({ airDate: '2026-11-12T19:00:00.000Z', showPopularity: 5 });
    const [, , , thursday] = groupEpisodesByDay(range([late, niche, popular]), '2026-11-09');

    expect(thursday.episodes).toEqual([popular, niche, late]);
  });
});

describe('summarizePast', () => {
  const day = (episodes: CalendarDay['episodes']): CalendarDay[] => [
    { key: '2026-11-10', episodes },
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
});

describe('splitWeek', () => {
  const days: CalendarDay[] = [
    { key: '2026-11-09', episodes: [episode()] },
    { key: '2026-11-10', episodes: [] },
    { key: '2026-11-15', episodes: [episode()] },
  ];

  it('collapses days before today and drops empty ones', () => {
    const layout = splitWeek(days, '2026-11-15');
    expect(layout.past.map((day) => day.key)).toEqual(['2026-11-09']);
    expect(layout.upcoming.map((day) => day.key)).toEqual(['2026-11-15']);
  });

  it('keeps other weeks expanded', () => {
    expect(splitWeek(days, undefined).past).toEqual([]);
  });
});

describe('pickableDays', () => {
  it('offers past days only while the past block can open', () => {
    const upcoming: CalendarDay = { key: '2026-11-15', episodes: [episode()] };
    const watchedPast: CalendarDay = {
      key: '2026-11-10',
      episodes: [episode({ isTracked: true, isWatched: true })],
    };
    const unwatchedPast: CalendarDay = { key: '2026-11-11', episodes: [episode()] };

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
    const days = groupEpisodesByDay(
      range([episode({ airDate: '2026-11-18T19:00:00.000Z' })]),
      '2026-11-16',
    );

    expect([...buildStripWeek(days, '2026-11-16', '2026-11-15').pickable]).toEqual(['2026-11-18']);
  });
});
