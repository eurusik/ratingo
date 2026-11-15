import fc from 'fast-check';
import { calendarEpisode as episode } from './calendar-episode.fixture';
import { episodeAction, episodeMark, planDay } from './day-plan';

const NOW = Date.parse('2026-11-12T12:00:00.000Z');
const AIRED = '2026-11-12T08:00:00.000Z';
const FUTURE = '2026-11-14T08:00:00.000Z';

describe('planDay', () => {
  it('shows everything in “Mine”', () => {
    const episodes = ['a', 'b', 'c', 'd'].map((showId) => episode({ showId }));
    expect(planDay(episodes, 'mine')).toEqual({ visible: episodes, hidden: [], hiddenShows: 0 });
  });

  it('keeps the three most popular shows in “All” and counts the rest', () => {
    const show = (showId: string, showPopularity: number) => episode({ showId, showPopularity });
    const plan = planDay(
      [show('low', 1), show('top', 90), show('mid', 50), show('top', 90), show('high', 70)],
      'all',
    );

    expect(plan.visible.map((item) => item.showId)).toEqual(['top', 'top', 'high', 'mid']);
    expect(plan.hiddenShows).toBe(1);
  });

  it('keeps the viewer’s own shows visible even when they are not popular', () => {
    const shows = ['a', 'b', 'c', 'd'].map((showId, index) =>
      episode({ showId, showPopularity: 100 - index }),
    );
    const tracked = episode({ showId: 'mine', showPopularity: 0, isTracked: true });
    const plan = planDay([...shows, tracked], 'all');

    expect(plan.visible.map((item) => item.showId)).toEqual(['a', 'b', 'c', 'mine']);
    expect(plan.hiddenShows).toBe(1);
  });

  it('never loses an episode', () => {
    const arbitraryEpisode = fc
      .record({
        showId: fc.constantFrom('a', 'b', 'c', 'd', 'e'),
        showPopularity: fc.nat(100),
        isTracked: fc.boolean(),
      })
      .map((fields) => episode(fields));
    fc.assert(
      fc.property(fc.array(arbitraryEpisode, { maxLength: 30 }), (episodes) => {
        const plan = planDay(episodes, 'all');
        expect(plan.visible.length + plan.hidden.length).toBe(episodes.length);
        expect(plan.hidden.some((item) => item.isTracked)).toBe(false);
      }),
    );
  });
});

describe('episodeMark', () => {
  it('marks premieres and known finales', () => {
    expect(episodeMark(episode({ episodeNumber: 1 }))).toBe('premiere');
    expect(episodeMark(episode({ episodeNumber: 8, seasonEpisodeCount: 8 }))).toBe('finale');
    expect(episodeMark(episode({ episodeNumber: 8, seasonEpisodeCount: null }))).toBeUndefined();
    expect(episodeMark(episode({ episodeNumber: 1, seasonEpisodeCount: 1 }))).toBe('premiere');
    expect(episodeMark(episode({ seasonNumber: 0, episodeNumber: 1 }))).toBeUndefined();
  });
});

describe('episodeAction', () => {
  const context = { mode: 'mine' as const, now: NOW, viewer: 'signedIn' as const };

  it('offers ✓ for aired episodes of tracked shows and a reminder for upcoming ones', () => {
    expect(episodeAction(episode({ isTracked: true, airDate: AIRED }), context)).toBe('watch');
    expect(episodeAction(episode({ isTracked: true, airDate: FUTURE }), context)).toBe('remind');
  });

  it('offers to start saved premieres in “Mine” and any show in “All”', () => {
    expect(episodeAction(episode({ isSaved: true }), context)).toBe('start');
    expect(episodeAction(episode(), context)).toBe('none');
    expect(episodeAction(episode(), { ...context, mode: 'all' })).toBe('start');
  });

  it('hides actions while the viewer is unknown', () => {
    expect(
      episodeAction(episode({ isTracked: true, airDate: AIRED }), {
        ...context,
        viewer: 'resolving',
      }),
    ).toBe('none');
  });
});
