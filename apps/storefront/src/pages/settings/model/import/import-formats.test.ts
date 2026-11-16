import { readCsvTable } from './csv-table';
import { inspectCsv } from './import-file';
import { SOURCE_FORMATS } from './import-sources';

const KINOBAZA_RATINGS = `kinobazaua_id,imdb_id,themoviedb_id,my_rating,name_uk,name_en,year,created_at
1,tt1234567,550,8,Бійцівський клуб,Fight Club,1999,2023-01-01
2,tt7654321,101,6,Початок,Inception,2010,2023-01-02
3,,27205,7,,Inception 2,2025,2023-01-03
4,,,5,Без ідентифікатора,,2020,2023-01-04`;

const KINOBAZA_WATCHLIST = `kinobazaua_id,imdb_id,themoviedb_id,name_uk,name_en,year,created_at
1,tt1111111,1001,Список 1,List Item 1,2022,2023-01-01
2,tt2222222,,Список 2,List Item 2,2021,2023-01-02
3,,,Без ідентифікатора,,2020,2023-01-03`;

const IMDB_HEADER =
  'Position,Const,Created,Modified,Description,Title,URL,Title Type,IMDb Rating,Runtime (mins),Year,Genres,Num Votes,Release Date,Directors,Your Rating,Date Rated';

const IMDB_RATINGS = `${IMDB_HEADER}
1,tt0111161,2023-01-01,2023-01-01,,The Shawshank Redemption,url,Movie,9.3,142,1994,"Drama",2800000,1994-10-14,Frank Darabont,10,2023-01-15
2,tt0903747,2023-01-02,2023-01-02,,Breaking Bad,url,TV Series,9.5,49,2008,"Crime, Drama",2100000,2008-01-20,,9,2023-02-20
3,,2023-01-03,2023-01-03,,No ID Movie,url,Movie,5.0,90,2020,"Drama",1000,2020-01-01,,7,2023-03-01`;

const IMDB_WATCHLIST = `${IMDB_HEADER}
1,tt0468569,2023-06-01,2023-06-01,,The Dark Knight,url,Movie,9.0,152,2008,"Action, Crime, Drama",2700000,2008-07-18,Christopher Nolan,,
2,tt1375666,2023-06-02,2023-06-02,,Inception,url,Movie,8.8,148,2010,"Action, Sci-Fi",2400000,2010-07-16,Christopher Nolan,,`;

const TMDB_HEADER =
  'TMDb ID,IMDb ID,Type,Name,Release Date,Season Number,Episode Number,Rating,Your Rating,Date Rated';

const TMDB_RATINGS = `${TMDB_HEADER}
550,tt0137523,movie,Fight Club,1999-10-15,,,,8.5,2024-01-15
1399,tt0944947,tv,Game of Thrones,2011-04-17,,,8.4,9.0,2024-01-20
680,,movie,Pulp Fiction,1994-10-14,,,8.9,7.5,2024-02-01
0,,movie,No IDs,2020-01-01,,,5.0,8.0,2024-01-01`;

const TMDB_WATCHLIST = `${TMDB_HEADER}
120,tt0120737,movie,The Fellowship of the Ring,2001-12-18,,,8.9,,2024-03-01`;

const UNRELATED = `id,title,rating
1,Movie,5`;

const detect = (source: keyof typeof SOURCE_FORMATS, text: string) =>
  SOURCE_FORMATS[source].detect(readCsvTable(text));

describe('Kinobaza files', () => {
  it('detects ratings by the my_rating column and watchlists without it', () => {
    expect(detect('kinobaza', KINOBAZA_RATINGS)).toBe('ratings');
    expect(detect('kinobaza', `\uFEFF${KINOBAZA_WATCHLIST}`)).toBe('watchlist');
    expect(detect('kinobaza', UNRELATED)).toBeUndefined();
  });

  it('reads ratings, preferring the English title and skipping rows without ids', () => {
    expect(inspectCsv(KINOBAZA_RATINGS, 'kinobaza')).toEqual({
      kind: 'ratings',
      skippedRows: 1,
      items: [
        { imdbId: 'tt1234567', tmdbId: 550, rating: 8, title: 'Fight Club', year: 1999, state: 'completed' },
        { imdbId: 'tt7654321', tmdbId: 101, rating: 6, title: 'Inception', year: 2010, state: 'completed' },
        { imdbId: undefined, tmdbId: 27205, rating: 7, title: 'Inception 2', year: 2025, state: 'completed' },
      ],
    });
  });

  it('reads the watchlist as planned titles without ratings', () => {
    const verdict = inspectCsv(KINOBAZA_WATCHLIST, 'kinobaza');
    expect(verdict).toMatchObject({ kind: 'watchlist', skippedRows: 1 });
    expect('items' in verdict && verdict.items.every((item) => item.state === 'planned' && item.rating === undefined)).toBe(true);
  });

  it('treats a zero id as missing and falls back to the Ukrainian title', () => {
    const csv = `kinobazaua_id,imdb_id,themoviedb_id,my_rating,name_uk,name_en,year
1,0,0,5,Нуль,,2023
2,tt0000001,100,7,Назва Українська,,2020`;
    expect(inspectCsv(csv, 'kinobaza')).toMatchObject({
      skippedRows: 1,
      items: [{ imdbId: 'tt0000001', title: 'Назва Українська' }],
    });
  });
});

describe('IMDb files', () => {
  it('tells ratings from a watchlist by the first row and rejects other sources', () => {
    expect(detect('imdb', IMDB_RATINGS)).toBe('ratings');
    expect(detect('imdb', IMDB_WATCHLIST)).toBe('watchlist');
    expect(detect('imdb', KINOBAZA_RATINGS)).toBeUndefined();
    expect(detect('imdb', TMDB_RATINGS)).toBeUndefined();
    expect(detect('imdb', IMDB_HEADER)).toBeUndefined();
  });

  it('reads ratings with the title type and skips rows without Const', () => {
    expect(inspectCsv(IMDB_RATINGS, 'imdb')).toEqual({
      kind: 'ratings',
      skippedRows: 1,
      items: [
        { imdbId: 'tt0111161', rating: 10, title: 'The Shawshank Redemption', year: 1994, kind: 'movie', state: 'completed' },
        { imdbId: 'tt0903747', rating: 9, title: 'Breaking Bad', year: 2008, kind: 'show', state: 'completed' },
      ],
    });
  });

  it('leaves a non-numeric rating out', () => {
    const csv = `${IMDB_HEADER}\n1,tt0111161,,,,Shawshank,url,Movie,9.3,142,1994,Drama,1,1994-10-14,,abc,`;
    expect(detect('imdb', csv)).toBe('ratings');
    expect(inspectCsv(csv, 'imdb')).toMatchObject({ items: [{ rating: undefined }] });
  });

  it('reads Windows line endings', () => {
    expect(detect('imdb', IMDB_RATINGS.replaceAll('\n', '\r\n'))).toBe('ratings');
  });
});

describe('TMDB files', () => {
  it('tells ratings from a watchlist and rejects other sources', () => {
    expect(detect('tmdb', TMDB_RATINGS)).toBe('ratings');
    expect(detect('tmdb', `\uFEFF${TMDB_WATCHLIST}`)).toBe('watchlist');
    expect(detect('tmdb', IMDB_RATINGS)).toBeUndefined();
    expect(detect('tmdb', KINOBAZA_RATINGS)).toBeUndefined();
    expect(detect('tmdb', TMDB_HEADER)).toBeUndefined();
  });

  it('reads decimal ratings, the media type and the release year', () => {
    expect(inspectCsv(TMDB_RATINGS, 'tmdb')).toEqual({
      kind: 'ratings',
      skippedRows: 1,
      items: [
        { imdbId: 'tt0137523', tmdbId: 550, rating: 8.5, title: 'Fight Club', year: 1999, kind: 'movie', state: 'completed' },
        { imdbId: 'tt0944947', tmdbId: 1399, rating: 9, title: 'Game of Thrones', year: 2011, kind: 'show', state: 'completed' },
        { imdbId: undefined, tmdbId: 680, rating: 7.5, title: 'Pulp Fiction', year: 1994, kind: 'movie', state: 'completed' },
      ],
    });
  });

  it('keeps the 0.5 minimum and drops ratings outside 0.5–10', () => {
    const csv = `${TMDB_HEADER}\n1,,movie,Low,2020-01-01,,,,0.5,\n2,,movie,Zero,2020-01-01,,,,0,`;
    expect(inspectCsv(csv, 'tmdb')).toMatchObject({
      items: [{ rating: 0.5 }, { rating: undefined }],
    });
  });
});

describe('inspectCsv problems', () => {
  it('flags a file from another source', () => {
    expect(inspectCsv(IMDB_RATINGS, 'kinobaza')).toEqual({ problem: 'wrongSource' });
  });

  it('flags a file where no row has an id', () => {
    const csv = 'kinobazaua_id,imdb_id,themoviedb_id,name_en\n1,,,Nothing';
    expect(inspectCsv(csv, 'kinobaza')).toEqual({ problem: 'empty' });
  });
});
