import { linkedSeason, withoutSeasonParam } from './season-link';

describe('linkedSeason', () => {
  it('returns the linked season when the show has it', () => {
    expect(linkedSeason('?season=2', [1, 2, 3])).toBe(2);
    expect(linkedSeason('?season=0', [0, 1])).toBe(0);
  });

  it.each(['', '?season=', '?season=abc', '?season=1.5', '?season=9'])('ignores %p', (search) => {
    expect(linkedSeason(search, [0, 1, 2, 3])).toBeUndefined();
  });
});

describe('withoutSeasonParam', () => {
  it('drops only the season parameter', () => {
    expect(
      withoutSeasonParam({ pathname: '/shows/arcane', search: '?season=2&ref=x', hash: '#cast' }),
    ).toBe('/shows/arcane?ref=x#cast');
    expect(withoutSeasonParam({ pathname: '/shows/arcane', search: '?season=2', hash: '' })).toBe(
      '/shows/arcane',
    );
  });
});
