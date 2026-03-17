import {
  detectKinobazaFileType,
  parseKinobazaRatings,
  parseKinobazaWatchlist,
  detectImdbFileType,
  parseImdbRatings,
  parseImdbWatchlist,
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

// ---------------------------------------------------------------------------
// IMDB parsers
// ---------------------------------------------------------------------------

// IMDB V3 format — ratings and watchlist share the same columns
const IMDB_RATINGS_CSV = `Position,Const,Created,Modified,Description,Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors,Your Rating,Date Rated
1,tt0111161,2023-01-01,2023-01-01,,The Shawshank Redemption,https://www.imdb.com/title/tt0111161/,movie,9.3,142,1994,"Drama",2800000,1994-10-14,Frank Darabont,10,2023-01-15
2,tt0068646,2023-01-02,2023-01-02,,The Godfather,https://www.imdb.com/title/tt0068646/,movie,9.2,175,1972,"Crime, Drama",1900000,1972-03-24,Francis Ford Coppola,9,2023-02-20
3,,2023-01-03,2023-01-03,,No ID Movie,https://www.imdb.com/title/tt0000000/,movie,5.0,90,2020,"Drama",1000,2020-01-01,,7,2023-03-01`;

const IMDB_WATCHLIST_CSV = `Position,Const,Created,Modified,Description,Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors,Your Rating,Date Rated
1,tt0468569,2023-06-01,2023-06-01,,The Dark Knight,https://www.imdb.com/title/tt0468569/,movie,9.0,152,2008,"Action, Crime, Drama",2700000,2008-07-18,Christopher Nolan,,
2,tt1375666,2023-06-02,2023-06-02,,Inception,https://www.imdb.com/title/tt1375666/,movie,8.8,148,2010,"Action, Adventure, Sci-Fi",2400000,2010-07-16,Christopher Nolan,,`;

const IMDB_RATINGS_CSV_WITH_BOM = `\uFEFFPosition,Const,Created,Modified,Description,Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors,Your Rating,Date Rated
1,tt0111161,2023-01-01,2023-01-01,,The Shawshank Redemption,https://www.imdb.com/title/tt0111161/,movie,9.3,142,1994,"Drama",2800000,1994-10-14,Frank Darabont,10,2023-01-15`;

describe('detectImdbFileType', () => {
  it('returns "ratings" when first data row has Your Rating populated', () => {
    expect(detectImdbFileType(IMDB_RATINGS_CSV)).toBe('ratings');
  });

  it('returns "watchlist" when first data row has empty Your Rating', () => {
    expect(detectImdbFileType(IMDB_WATCHLIST_CSV)).toBe('watchlist');
  });

  it('returns "unknown" for non-IMDB CSV', () => {
    expect(detectImdbFileType(WRONG_CSV)).toBe('unknown');
  });

  it('returns "unknown" for Kinobaza CSV', () => {
    expect(detectImdbFileType(RATINGS_CSV)).toBe('unknown');
  });

  it('handles BOM prefix correctly', () => {
    expect(detectImdbFileType(IMDB_RATINGS_CSV_WITH_BOM)).toBe('ratings');
  });

  it('returns "unknown" when headers exist but no data rows', () => {
    const headersOnly = 'Position,Const,Created,Modified,Description,Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors,Your Rating,Date Rated';
    expect(detectImdbFileType(headersOnly)).toBe('unknown');
  });
});

describe('parseImdbRatings', () => {
  it('parses valid ratings CSV into ParsedItem array', async () => {
    const { items, skippedRows } = await parseImdbRatings(IMDB_RATINGS_CSV);

    // Row 3 has no Const → skipped
    expect(skippedRows).toBe(1);
    expect(items).toHaveLength(2);

    expect(items[0]).toMatchObject({
      imdbId: 'tt0111161',
      rating: 10,
      state: 'completed',
      title: 'The Shawshank Redemption',
      year: 1994,
    });

    expect(items[1]).toMatchObject({
      imdbId: 'tt0068646',
      rating: 9,
      state: 'completed',
      title: 'The Godfather',
      year: 1972,
    });
  });

  it('all items have state "completed"', async () => {
    const { items } = await parseImdbRatings(IMDB_RATINGS_CSV);
    expect(items.every((item) => item.state === 'completed')).toBe(true);
  });

  it('handles BOM prefix correctly', async () => {
    const { items, skippedRows } = await parseImdbRatings(IMDB_RATINGS_CSV_WITH_BOM);
    expect(skippedRows).toBe(0);
    expect(items).toHaveLength(1);
    expect(items[0].imdbId).toBe('tt0111161');
    expect(items[0].rating).toBe(10);
  });

  it('throws descriptive error for wrong headers', async () => {
    await expect(parseImdbRatings(WRONG_CSV)).rejects.toThrow(
      /Invalid IMDB ratings file: missing column/,
    );
  });

  it('skips rows with empty Const', async () => {
    const { skippedRows } = await parseImdbRatings(IMDB_RATINGS_CSV);
    expect(skippedRows).toBe(1);
  });

  it('does not include tmdbId field (IMDB has no TMDB column)', async () => {
    const { items } = await parseImdbRatings(IMDB_RATINGS_CSV);
    expect(items.every((item) => item.tmdbId === undefined)).toBe(true);
  });
});

describe('parseImdbWatchlist', () => {
  it('parses valid watchlist CSV into ParsedItem array', async () => {
    const { items, skippedRows } = await parseImdbWatchlist(IMDB_WATCHLIST_CSV);

    expect(skippedRows).toBe(0);
    expect(items).toHaveLength(2);

    expect(items[0]).toMatchObject({
      imdbId: 'tt0468569',
      state: 'planned',
      title: 'The Dark Knight',
      year: 2008,
    });

    expect(items[1]).toMatchObject({
      imdbId: 'tt1375666',
      state: 'planned',
      title: 'Inception',
      year: 2010,
    });
  });

  it('all items have state "planned"', async () => {
    const { items } = await parseImdbWatchlist(IMDB_WATCHLIST_CSV);
    expect(items.every((item) => item.state === 'planned')).toBe(true);
  });

  it('no rating field in watchlist items', async () => {
    const { items } = await parseImdbWatchlist(IMDB_WATCHLIST_CSV);
    expect(items.every((item) => item.rating === undefined)).toBe(true);
  });

  it('throws descriptive error for wrong headers', async () => {
    await expect(parseImdbWatchlist(WRONG_CSV)).rejects.toThrow(
      /Invalid IMDB watchlist file: missing column/,
    );
  });

  it('handles BOM prefix correctly', async () => {
    const withBom = '\uFEFF' + IMDB_WATCHLIST_CSV;
    const { items } = await parseImdbWatchlist(withBom);
    expect(items[0].imdbId).toBe('tt0468569');
  });

  it('skips rows with empty Const', async () => {
    const csvWithEmptyConst = `Position,Const,Created,Modified,Description,Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors,Your Rating,Date Rated
1,tt0468569,2023-06-01,2023-06-01,,The Dark Knight,https://www.imdb.com/title/tt0468569/,movie,9.0,152,2008,"Action",2700000,2008-07-18,Christopher Nolan,,
2,,2023-06-02,2023-06-02,,No ID,https://www.imdb.com/title/tt0000000/,movie,5.0,90,2020,"Drama",1000,2020-01-01,,,`;
    const { items, skippedRows } = await parseImdbWatchlist(csvWithEmptyConst);
    expect(skippedRows).toBe(1);
    expect(items).toHaveLength(1);
  });
});
