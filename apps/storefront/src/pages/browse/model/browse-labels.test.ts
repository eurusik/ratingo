import { getDictionary } from '@/shared/i18n';
import { countLabel, yearPresetLabel, yearRangeLabel } from './browse-labels';
import { bestRemoval, filterRemovals } from './filter-removals';
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
    expect(removals[1]).toMatchObject({ range: { yearFrom: 2020, yearTo: 2029 } });
    expect(removals[1]?.next).toMatchObject({ yearFrom: undefined, yearTo: undefined, minScore: 7 });
    expect(removals[2]?.next).toMatchObject({ minScore: undefined, genres: ['drama'] });
  });
});

describe('bestRemoval', () => {
  it('picks the removal that brings back the most titles and ignores empty ones', () => {
    const [genre, year, score] = filterRemovals({
      genres: ['drama'],
      yearFrom: 2020,
      yearTo: 2029,
      minScore: 8,
    });
    if (!genre || !year || !score) throw new Error('Expected three removals');

    expect(
      bestRemoval([
        { removal: genre, total: 4 },
        { removal: year, total: 12 },
        { removal: score, total: 0 },
      ])?.removal.id,
    ).toBe('year');
    expect(bestRemoval([{ removal: score, total: 0 }])).toBeUndefined();
  });
});

describe('countLabel grouping', () => {
  it('groups thousands with a no-break space on both server and client', () => {
    expect(countLabel(uk, 'uk', 'movie', 4210)).toBe('4\u00a0210 фільмів');
  });
});
