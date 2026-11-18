import type { ShowSeason } from '@/shared/api';
import { hasAired, isTrackable, nextUpcoming, toSeasons, trackableEpisodes } from './season';

const NOW = Date.parse('2026-11-14T12:00:00Z');

describe('toSeasons', () => {
  it('drops specials and empty seasons and orders seasons and episodes by number', () => {
    const seasons: ShowSeason[] = [
      {
        number: 2,
        episodes: [
          { id: 'b2', number: 2 },
          { id: 'b1', number: 1, title: ' Пілот ' },
        ],
      },
      { number: 0, episodes: [{ id: 'special', number: 1 }] },
      { number: 3, episodes: [] },
      { number: 1, name: 'Book One', episodes: [{ id: 'a1', number: 1, runtime: 0 }] },
    ];

    expect(toSeasons(seasons)).toEqual([
      {
        number: 1,
        name: 'Book One',
        episodes: [{ id: 'a1', seasonNumber: 1, number: 1 }],
      },
      {
        number: 2,
        name: undefined,
        episodes: [
          { id: 'b1', seasonNumber: 2, number: 1, title: 'Пілот' },
          { id: 'b2', seasonNumber: 2, number: 2 },
        ],
      },
    ]);
  });
});

describe('toSeasons placeholders', () => {
  it('drops placeholder titles so the episode falls back to its number', () => {
    const [season] = toSeasons([
      {
        number: 4,
        episodes: [
          { id: 'a', number: 1, title: 'TBA' },
          { id: 'b', number: 2, title: ' tbd ' },
          { id: 'c', number: 3, title: 'Tbilisi' },
        ],
      },
    ]);

    expect(season.episodes.map((episode) => episode.title)).toEqual([
      undefined,
      undefined,
      'Tbilisi',
    ]);
  });
});

describe('hasAired', () => {
  it('treats a past air date as aired and a future one as upcoming', () => {
    expect(hasAired({ seasonNumber: 1, number: 1, airDate: '2026-11-14' }, NOW)).toBe(true);
    expect(hasAired({ seasonNumber: 1, number: 1, airDate: '2026-11-15' }, NOW)).toBe(false);
  });

  it('treats an episode airing exactly now as aired', () => {
    expect(
      hasAired({ seasonNumber: 1, number: 1, airDate: new Date(NOW).toISOString() }, NOW),
    ).toBe(true);
  });

  it('treats a missing or unparseable air date as not aired, matching server progress', () => {
    expect(hasAired({ seasonNumber: 1, number: 1 }, NOW)).toBe(false);
    expect(hasAired({ seasonNumber: 1, number: 1, airDate: 'soon' }, NOW)).toBe(false);
  });

  it('cannot track an episode without an id or an air date', () => {
    expect(isTrackable({ seasonNumber: 1, number: 1, airDate: '2026-11-14' }, NOW)).toBe(false);
    expect(isTrackable({ id: 'e', seasonNumber: 1, number: 1 }, NOW)).toBe(false);
    expect(isTrackable({ id: 'e', seasonNumber: 1, number: 1, airDate: '2026-11-14' }, NOW)).toBe(
      true,
    );
  });
});

describe('trackableEpisodes and nextUpcoming', () => {
  const season = {
    number: 4,
    episodes: [
      { id: 'dated', seasonNumber: 4, number: 1, airDate: '2026-11-01' },
      { id: 'undated', seasonNumber: 4, number: 2 },
      { id: 'garbled', seasonNumber: 4, number: 3, airDate: 'soon' },
      { id: 'future', seasonNumber: 4, number: 4, airDate: '2027-07-09' },
    ],
  };

  it('tracks only episodes with a known past air date', () => {
    expect(trackableEpisodes([season], NOW).map((episode) => episode.id)).toEqual(['dated']);
  });

  it('treats only a known future air date as upcoming', () => {
    expect(nextUpcoming([season], NOW)?.id).toBe('future');
  });

  it('finds nothing upcoming when the remaining episodes have no usable date', () => {
    const undatedOnly = { ...season, episodes: season.episodes.slice(0, 3) };
    expect(nextUpcoming([undatedOnly], NOW)).toBeUndefined();
  });
});
