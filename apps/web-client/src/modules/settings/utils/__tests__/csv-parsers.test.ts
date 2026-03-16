import {
  detectKinobazaFileType,
  parseKinobazaRatings,
  parseKinobazaWatchlist,
} from '../csv-parsers';

const RATINGS_CSV = `kinobazaua_id,imdb_id,themoviedb_id,my_rating,name_uk,name_en,year,created_at
1,tt1234567,550,8,Бійцівський клуб,Fight Club,1999,2023-01-01
2,tt7654321,101,6,Початок,Inception,2010,2023-01-02
3,,27205,7,,Inception 2,2025,2023-01-03
4,,,5,Без ідентифікатора,,2020,2023-01-04`;

const WATCHLIST_CSV = `kinobazaua_id,imdb_id,themoviedb_id,name_uk,name_en,year,created_at
1,tt1111111,1001,Список 1,List Item 1,2022,2023-01-01
2,tt2222222,,Список 2,List Item 2,2021,2023-01-02
3,,,Без ідентифікатора,,2020,2023-01-03`;

const RATINGS_CSV_WITH_BOM = `\uFEFFkinobazaua_id,imdb_id,themoviedb_id,my_rating,name_uk,name_en,year,created_at
1,tt9999999,777,10,Тест,Test,2024,2023-01-01`;

const WRONG_CSV = `id,title,rating
1,Movie,5`;

describe('detectKinobazaFileType', () => {
  it('returns "ratings" when my_rating column is present', () => {
    expect(detectKinobazaFileType(RATINGS_CSV)).toBe('ratings');
  });

  it('returns "watchlist" when kinobazaua_id is present but my_rating is not', () => {
    expect(detectKinobazaFileType(WATCHLIST_CSV)).toBe('watchlist');
  });

  it('returns "unknown" for unrecognized CSV format', () => {
    expect(detectKinobazaFileType(WRONG_CSV)).toBe('unknown');
  });

  it('handles BOM prefix correctly', () => {
    expect(detectKinobazaFileType(RATINGS_CSV_WITH_BOM)).toBe('ratings');
  });

  it('handles watchlist with BOM', () => {
    const watchlistWithBom = '\uFEFF' + WATCHLIST_CSV;
    expect(detectKinobazaFileType(watchlistWithBom)).toBe('watchlist');
  });
});

describe('parseKinobazaRatings', () => {
  it('parses valid ratings CSV into ParsedItem array', async () => {
    const { items, skippedRows } = await parseKinobazaRatings(RATINGS_CSV);

    // Row 4 has no IMDB or TMDB → skipped
    expect(skippedRows).toBe(1);
    expect(items).toHaveLength(3);

    expect(items[0]).toMatchObject({
      imdbId: 'tt1234567',
      tmdbId: 550,
      rating: 8,
      state: 'completed',
      title: 'Fight Club',
      year: 1999,
    });

    expect(items[1]).toMatchObject({
      imdbId: 'tt7654321',
      tmdbId: 101,
      rating: 6,
      state: 'completed',
      title: 'Inception',
      year: 2010,
    });

    // Row 3: no IMDB, but has TMDB
    expect(items[2]).toMatchObject({
      imdbId: undefined,
      tmdbId: 27205,
      rating: 7,
      state: 'completed',
      title: 'Inception 2',
      year: 2025,
    });
  });

  it('all items have state "completed"', async () => {
    const { items } = await parseKinobazaRatings(RATINGS_CSV);
    expect(items.every((item) => item.state === 'completed')).toBe(true);
  });

  it('handles BOM prefix correctly', async () => {
    const { items, skippedRows } = await parseKinobazaRatings(RATINGS_CSV_WITH_BOM);
    expect(skippedRows).toBe(0);
    expect(items).toHaveLength(1);
    expect(items[0].imdbId).toBe('tt9999999');
    expect(items[0].rating).toBe(10);
  });

  it('throws descriptive error for wrong headers', async () => {
    await expect(parseKinobazaRatings(WRONG_CSV)).rejects.toThrow(
      /Invalid Kinobaza ratings file: missing column/,
    );
  });

  it('throws error mentioning which column is missing', async () => {
    await expect(parseKinobazaRatings(WRONG_CSV)).rejects.toThrow('kinobazaua_id');
  });

  it('skips rows with missing required identifiers', async () => {
    const { skippedRows } = await parseKinobazaRatings(RATINGS_CSV);
    expect(skippedRows).toBe(1);
  });

  it('treats imdb_id of 0 as missing', async () => {
    const csv = `kinobazaua_id,imdb_id,themoviedb_id,my_rating,name_en,year,created_at
1,0,0,5,Test Movie,2023,2023-01-01`;
    const { items, skippedRows } = await parseKinobazaRatings(csv);
    expect(skippedRows).toBe(1);
    expect(items).toHaveLength(0);
  });

  it('falls back to name_uk if name_en is empty', async () => {
    const csv = `kinobazaua_id,imdb_id,themoviedb_id,my_rating,name_uk,name_en,year,created_at
1,tt0000001,100,7,Назва Українська,,2020,2023-01-01`;
    const { items } = await parseKinobazaRatings(csv);
    expect(items[0].title).toBe('Назва Українська');
  });
});

describe('parseKinobazaWatchlist', () => {
  it('parses valid watchlist CSV into ParsedItem array', async () => {
    const { items, skippedRows } = await parseKinobazaWatchlist(WATCHLIST_CSV);

    // Row 3 has no IMDB or TMDB → skipped
    expect(skippedRows).toBe(1);
    expect(items).toHaveLength(2);

    expect(items[0]).toMatchObject({
      imdbId: 'tt1111111',
      tmdbId: 1001,
      state: 'planned',
      title: 'List Item 1',
      year: 2022,
    });

    // Row 2: IMDB present, no TMDB
    expect(items[1]).toMatchObject({
      imdbId: 'tt2222222',
      tmdbId: undefined,
      state: 'planned',
      title: 'List Item 2',
      year: 2021,
    });
  });

  it('all items have state "planned"', async () => {
    const { items } = await parseKinobazaWatchlist(WATCHLIST_CSV);
    expect(items.every((item) => item.state === 'planned')).toBe(true);
  });

  it('no rating field in watchlist items', async () => {
    const { items } = await parseKinobazaWatchlist(WATCHLIST_CSV);
    expect(items.every((item) => item.rating === undefined)).toBe(true);
  });

  it('throws descriptive error for wrong headers', async () => {
    await expect(parseKinobazaWatchlist(WRONG_CSV)).rejects.toThrow(
      /Invalid Kinobaza watchlist file: missing column/,
    );
  });

  it('skips rows with missing required identifiers', async () => {
    const { skippedRows } = await parseKinobazaWatchlist(WATCHLIST_CSV);
    expect(skippedRows).toBe(1);
  });

  it('handles BOM prefix correctly', async () => {
    const withBom = '\uFEFF' + WATCHLIST_CSV;
    const { items } = await parseKinobazaWatchlist(withBom);
    expect(items[0].imdbId).toBe('tt1111111');
  });
});
