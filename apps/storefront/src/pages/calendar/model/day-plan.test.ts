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

describe('planDay in “Premieres”', () => {
  const premiere = (showId: string, seasonNumber: number, showPopularity = 10) =>
    episode({ showId, seasonNumber, episodeNumber: 1, showPopularity });

  it('lists every premiere of the day without folding unpopular shows', () => {
    const premieres = ['a', 'b', 'c', 'd', 'e'].map((showId, index) =>
      premiere(showId, 2, 100 - index),
    );
    const plan = planDay(premieres, 'premieres');

    expect(plan.visible).toEqual(premieres);
    expect(plan.hiddenShows).toBe(0);
  });

  it('puts new shows before returning ones and keeps the order within each group', () => {
    const plan = planDay(
      [premiere('back', 3, 90), premiere('new', 1, 5), premiere('back-too', 2, 50)],
      'premieres',
    );

    expect(plan.visible.map((item) => item.showId)).toEqual(['new', 'back', 'back-too']);
  });

  it('shows one card per show when a whole season drops at once', () => {
    const binge = [1, 2, 3].map((episodeNumber) =>
      episode({ showId: 'binge', seasonNumber: 1, episodeNumber }),
    );
    const plan = planDay(binge, 'premieres');

    expect(plan.visible).toEqual([binge[0]]);
  });

  it('leaves out regular episodes and specials', () => {
    const plan = planDay(
      [
        episode({ seasonNumber: 2, episodeNumber: 4 }),
        episode({ showId: 'special', seasonNumber: 0, episodeNumber: 1 }),
      ],
      'premieres',
    );

    expect(plan.visible).toEqual([]);
  });

  it('keeps only season premieres, each show once, new shows first', () => {
    const arbitraryEpisode = fc
      .record({
        showId: fc.constantFrom('a', 'b', 'c', 'd'),
        seasonNumber: fc.nat(4),
        episodeNumber: fc.integer({ min: 1, max: 3 }),
      })
      .map((fields) => episode(fields));
    fc.assert(
      fc.property(fc.array(arbitraryEpisode, { maxLength: 30 }), (episodes) => {
        const { visible } = planDay(episodes, 'premieres');
        const showIds = visible.map((item) => item.showId);
        const isNewShow = visible.map((item) => item.seasonNumber === 1);
        expect(new Set(showIds).size).toBe(showIds.length);
        expect(visible.every((item) => item.episodeNumber === 1 && item.seasonNumber > 0)).toBe(
          true,
        );
        expect(isNewShow).toEqual(
          [...isNewShow].sort((left, right) => Number(right) - Number(left)),
        );
      }),
    );
  });
});

describe('episodeMark', () => {
  it('tells new shows from new seasons and marks known finales', () => {
    expect(episodeMark(episode({ seasonNumber: 1, episodeNumber: 1 }))).toBe('newSeries');
    expect(episodeMark(episode({ seasonNumber: 3, episodeNumber: 1 }))).toBe('newSeason');
    expect(episodeMark(episode({ episodeNumber: 8, seasonEpisodeCount: 8 }))).toBe('finale');
    expect(episodeMark(episode({ episodeNumber: 8, seasonEpisodeCount: null }))).toBeUndefined();
    expect(episodeMark(episode({ episodeNumber: 1, seasonEpisodeCount: 1 }))).toBe('newSeries');
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

  it('offers to save a show whose first episode has not aired yet, in both modes', () => {
    const premiere = { seasonNumber: 1, episodeNumber: 1, airDate: FUTURE };
    expect(episodeAction(episode(premiere), context)).toBe('save');
    expect(episodeAction(episode({ ...premiere, isSaved: true }), context)).toBe('save');
    expect(episodeAction(episode(premiere), { ...context, mode: 'all', viewer: 'guest' })).toBe(
      'save',
    );
  });

  it.each(['all', 'premieres'] as const)(
    'offers to start in “%s” once the series premiere has aired, or for a season premiere',
    (mode) => {
      const broadMode = { ...context, mode };
      expect(
        episodeAction(episode({ seasonNumber: 1, episodeNumber: 1, airDate: AIRED }), broadMode),
      ).toBe('start');
      expect(
        episodeAction(episode({ seasonNumber: 3, episodeNumber: 1, airDate: FUTURE }), broadMode),
      ).toBe('start');
    },
  );

  it('offers to save an unreleased new show in “Premieres”', () => {
    const premiere = episode({ seasonNumber: 1, episodeNumber: 1, airDate: FUTURE });
    expect(episodeAction(premiere, { ...context, mode: 'premieres', viewer: 'guest' })).toBe(
      'save',
    );
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
