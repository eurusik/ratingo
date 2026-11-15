import { calendarEpisode as episode, calendarRange as range } from './calendar-episode.fixture';
import { hasTrackedShows, withTracked, withWatched } from './calendar-range';

describe('calendar range updates', () => {
  it('marks only the given episode watched', () => {
    const target = episode();
    const other = episode();
    const [updated] = withWatched(range([target, other]), target.episodeId, true).days;
    expect(updated.episodes.map((item) => item.isWatched)).toEqual([true, false]);
  });

  it('marks every episode of a started show as tracked', () => {
    const started = episode({ showId: 'andor' });
    const other = episode({ showId: 'other' });
    const [updated] = withTracked(range([started, other]), 'andor').days;
    expect(updated.episodes.map((item) => item.isTracked)).toEqual([true, false]);
  });

  it('knows when the viewer tracks shows', () => {
    expect(hasTrackedShows(range([], 2))).toBe(true);
    expect(hasTrackedShows(range([], 0))).toBe(false);
    expect(hasTrackedShows(undefined)).toBe(false);
  });
});
