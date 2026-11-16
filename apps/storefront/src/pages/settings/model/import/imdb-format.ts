import { hasHeaders, kindByRatedRows, type ImportFormat } from './import-format';
import { imdbIdFrom, positiveInt, ratingFrom, type ImportMediaKind } from './import-item';

const RATING_HEADER = 'your rating';
const REQUIRED_HEADERS = ['const', RATING_HEADER, 'title', 'year'] as const;
const SERIES_TYPE = /series/i;

function mediaKind(titleType: string | undefined): ImportMediaKind | undefined {
  if (!titleType) return undefined;
  return SERIES_TYPE.test(titleType) ? 'show' : 'movie';
}

export const IMDB_FORMAT: ImportFormat = {
  detect: (table) =>
    hasHeaders(table, REQUIRED_HEADERS) ? kindByRatedRows(table, RATING_HEADER) : undefined,
  toItem: (record, kind) => ({
    imdbId: imdbIdFrom(record.const),
    rating: kind === 'ratings' ? ratingFrom(record[RATING_HEADER]) : undefined,
    title: record.title || undefined,
    year: positiveInt(record.year),
    kind: mediaKind(record['title type']),
  }),
};
