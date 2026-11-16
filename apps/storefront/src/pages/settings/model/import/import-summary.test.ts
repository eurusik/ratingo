import type { ImportFile } from './import-file';
import { filterItems, summarizeImport, uniqueItems } from './import-summary';

const FILES: ImportFile[] = [
  {
    id: 'r',
    name: 'ratings.csv',
    status: 'ready',
    kind: 'ratings',
    skippedRows: 2,
    items: [
      { imdbId: 'tt1', rating: 9, state: 'completed', kind: 'movie' },
      { imdbId: 'tt2', rating: 8, state: 'completed', kind: 'show' },
    ],
  },
  {
    id: 'w',
    name: 'watchlist.csv',
    status: 'ready',
    kind: 'watchlist',
    skippedRows: 1,
    items: [{ imdbId: 'tt3', state: 'planned', kind: 'show' }],
  },
  { id: 'x', name: 'other.csv', status: 'rejected', problem: 'wrongSource' },
];

describe('summarizeImport', () => {
  it('counts ratings, the watchlist, skipped rows and rated shows from ready files only', () => {
    expect(summarizeImport(FILES)).toMatchObject({
      ratings: 2,
      watchlist: 1,
      skippedRows: 3,
      ratedShows: 1,
      hasUntypedRatings: false,
    });
  });

  it('notices ratings whose type the source does not say', () => {
    const untyped: ImportFile = {
      id: 'k',
      name: 'kinobaza.csv',
      status: 'ready',
      kind: 'ratings',
      skippedRows: 0,
      items: [{ tmdbId: 1, rating: 7, state: 'completed' }],
    };
    expect(summarizeImport([untyped]).hasUntypedRatings).toBe(true);
  });
});

describe('uniqueItems', () => {
  it('keeps one entry per title, preferring a rating, then a watched entry', () => {
    expect(
      uniqueItems([
        { imdbId: 'tt1', state: 'planned' },
        { imdbId: 'tt1', state: 'completed', rating: 7 },
        { imdbId: 'tt1', state: 'completed' },
        { tmdbId: 5, state: 'planned' },
        { tmdbId: 5, state: 'completed' },
      ]),
    ).toEqual([
      { imdbId: 'tt1', state: 'completed', rating: 7 },
      { tmdbId: 5, state: 'completed' },
    ]);
  });
});

describe('filterItems', () => {
  const { items } = summarizeImport(FILES);

  it('splits ratings from the watchlist', () => {
    expect(filterItems(items, 'all')).toHaveLength(3);
    expect(filterItems(items, 'ratings').map((item) => item.imdbId)).toEqual(['tt1', 'tt2']);
    expect(filterItems(items, 'watchlist').map((item) => item.imdbId)).toEqual(['tt3']);
  });
});
