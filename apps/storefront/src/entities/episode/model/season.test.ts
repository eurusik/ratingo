import type { ShowSeason } from '@/shared/api';
import { hasAired, isTrackable, toSeasons } from './season';

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

describe('hasAired', () => {
  it('treats a past or missing air date as aired and a future one as upcoming', () => {
    expect(hasAired({ seasonNumber: 1, number: 1, airDate: '2026-11-14' }, NOW)).toBe(true);
    expect(hasAired({ seasonNumber: 1, number: 1 }, NOW)).toBe(true);
    expect(hasAired({ seasonNumber: 1, number: 1, airDate: '2026-11-15' }, NOW)).toBe(false);
  });

  it('cannot track an episode without an id', () => {
    expect(isTrackable({ seasonNumber: 1, number: 1 }, NOW)).toBe(false);
    expect(isTrackable({ id: 'e', seasonNumber: 1, number: 1 }, NOW)).toBe(true);
  });
});
