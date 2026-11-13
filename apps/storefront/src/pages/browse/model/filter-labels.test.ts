import { getDictionary } from '@/shared/i18n';
import { countLabel, yearPresetLabel, yearRangeLabel } from './filter-labels';
import { filterRemovals } from './filter-removals';
import { yearPresets } from './year-presets';

const uk = getDictionary('uk');
const en = getDictionary('en');

describe('countLabel', () => {
  it.each([
    [1, '1 серіал'],
    [3, '3 серіали'],
    [5, '5 серіалів'],
    [11, '11 серіалів'],
    [21, '21 серіал'],
  ])('uses the Ukrainian plural for %i', (count, expected) => {
    expect(countLabel(uk, 'uk', 'show', count)).toBe(expected);
  });

  it('uses the English plural', () => {
    expect(countLabel(en, 'en', 'movie', 1)).toBe('1 movie');
    expect(countLabel(en, 'en', 'movie', 2)).toBe('2 movies');
  });
});

describe('year labels', () => {
  const presets = yearPresets(2026);

  it('names presets by year, decade and earlier', () => {
    expect(presets.map((preset) => yearPresetLabel(uk, preset))).toEqual([
      '2026',
      '2025',
      '2020-ті',
      '2010-ті',
      '2000-ні',
      'Раніше',
    ]);
  });

  it('falls back to a plain range for hand-written URLs', () => {
    expect(yearRangeLabel(uk, presets, { yearFrom: 2015, yearTo: 2018 })).toBe('2015–2018');
  });
});

describe('filterRemovals', () => {
  it('removes one filter at a time and keeps the rest', () => {
    const filters = { genres: ['drama' as const], yearFrom: 2020, yearTo: 2029, minScore: 7 as const };
    const removals = filterRemovals(filters);

    expect(removals.map((removal) => removal.id)).toEqual(['genre:drama', 'year', 'score']);
    expect(removals[0]?.next).toEqual({ ...filters, genres: [] });
    expect(removals[1]?.next).toMatchObject({ yearFrom: undefined, yearTo: undefined, minScore: 7 });
    expect(removals[2]?.next).toMatchObject({ minScore: undefined, genres: ['drama'] });
  });
});
