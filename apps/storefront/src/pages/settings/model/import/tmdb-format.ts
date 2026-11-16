import { hasHeaders, kindByRatedRows, type ImportFormat } from './import-format';
import { imdbIdFrom, positiveInt, ratingFrom, type ImportMediaKind } from './import-item';

const RATING_HEADER = 'your rating';
const REQUIRED_HEADERS = ['tmdb id', 'imdb id', RATING_HEADER, 'name'] as const;
const YEAR_LENGTH = 4;

const MEDIA_KINDS: Record<string, ImportMediaKind> = { movie: 'movie', tv: 'show' };

export const TMDB_FORMAT: ImportFormat = {
  detect: (table) =>
    hasHeaders(table, REQUIRED_HEADERS) ? kindByRatedRows(table, RATING_HEADER) : undefined,
  toItem: (record, kind) => ({
    imdbId: imdbIdFrom(record['imdb id']),
    tmdbId: positiveInt(record['tmdb id']),
    rating: kind === 'ratings' ? ratingFrom(record[RATING_HEADER]) : undefined,
    title: record.name || undefined,
    year: positiveInt(record['release date']?.slice(0, YEAR_LENGTH)),
    kind: MEDIA_KINDS[record.type?.toLowerCase() ?? ''],
  }),
  isTitleRow: (record) => !record['season number'] && !record['episode number'],
};
