import { formatCount, formatNumber } from './format-count';

const TITLES = { one: '{count} тайтл', few: '{count} тайтли', many: '{count} тайтлів' };

describe('formatCount', () => {
  it('picks the plural form and groups digits for the locale', () => {
    expect(formatCount(1, TITLES, 'uk')).toBe('1 тайтл');
    expect(formatCount(3, TITLES, 'uk')).toBe('3 тайтли');
    expect(formatCount(12_000, TITLES, 'uk')).toBe(`${formatNumber('uk', 12_000)} тайтлів`);
  });
});
