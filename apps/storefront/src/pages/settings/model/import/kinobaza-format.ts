import { hasHeaders, type ImportFormat } from './import-format';
import { imdbIdFrom, positiveInt, ratingFrom } from './import-item';

const REQUIRED_HEADERS = ['kinobazaua_id', 'imdb_id', 'themoviedb_id'] as const;
const RATING_HEADER = 'my_rating';

export const KINOBAZA_FORMAT: ImportFormat = {
  detect: (table) => {
    if (!hasHeaders(table, REQUIRED_HEADERS)) return undefined;
    return table.headers.includes(RATING_HEADER) ? 'ratings' : 'watchlist';
  },
  toItem: (record, kind) => ({
    imdbId: imdbIdFrom(record.imdb_id),
    tmdbId: positiveInt(record.themoviedb_id),
    rating: kind === 'ratings' ? ratingFrom(record[RATING_HEADER]) : undefined,
    title: record.name_en || record.name_uk || undefined,
    year: positiveInt(record.year),
  }),
};
