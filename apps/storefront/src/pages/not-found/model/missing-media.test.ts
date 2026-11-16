import fc from 'fast-check';
import { missingMediaAt, slugToSearchQuery } from './missing-media';

describe('slugToSearchQuery', () => {
  it.each([
    ['dyuna-chastyna-druha', 'дюна частина друга'],
    ['neznayomtsi-chastyna-druha', 'незнайомці частина друга'],
    ['nazad-u-maybutnye-chastyna-druha', 'назад у майбутнє частина друга'],
    ['rizdvyani-khroniky', 'різдвяні хроніки'],
    ['shchedryk', 'щедрик'],
    ['pinhvin-2024', 'пінгвін'],
  ])('turns %s into %s', (slug, query) => {
    expect(slugToSearchQuery(slug)).toBe(query);
  });

  it('leaves the search empty for slugs made from a TMDB id', () => {
    expect(slugToSearchQuery('tmdb-12345')).toBe('');
  });

  it('keeps Cyrillic slugs readable', () => {
    expect(slugToSearchQuery(encodeURIComponent('дюна-2'))).toBe('дюна');
  });

  it('survives a malformed escape', () => {
    expect(() => slugToSearchQuery('dyuna%E0')).not.toThrow();
  });

  it('never leaves Latin letters, digits-only words or separators behind', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z0-9-]{1,60}$/), (slug) => {
        const query = slugToSearchQuery(slug);
        expect(query).not.toMatch(/[a-z-]/);
        expect(query.split(' ').filter((word) => /^\d+$/.test(word))).toEqual([]);
      }),
    );
  });
});

describe('missingMediaAt', () => {
  it('recognises a movie, a show and its reviews page', () => {
    expect(missingMediaAt('/movies/dyuna')).toEqual({ type: 'movie', query: 'дюна' });
    expect(missingMediaAt('/shows/pinhvin/reviews')).toEqual({ type: 'show', query: 'пінгвін' });
  });

  it('ignores every other path', () => {
    expect(missingMediaAt('/nowhere')).toBeNull();
    expect(missingMediaAt('/movies')).toBeNull();
  });
});
