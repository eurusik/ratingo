import { and, eq, exists, gt, notExists, sql, type SQL } from 'drizzle-orm';

import * as schema from './schema';

export function effectiveMovieReleaseDate(): SQL<Date | null> {
  return sql<Date | null>`coalesce(${schema.movies.theatricalReleaseDate}, ${schema.movies.digitalReleaseDate}, ${schema.mediaItems.releaseDate})`;
}

function unreleasedMovieRow(now: Date): SQL {
  return sql`(select 1 from ${schema.movies} where ${and(
    eq(schema.movies.mediaItemId, schema.mediaItems.id),
    gt(effectiveMovieReleaseDate(), now.toISOString()),
  )})`;
}

export function excludeUnreleasedMovies(now: Date): SQL {
  return notExists(unreleasedMovieRow(now));
}

export function onlyUnreleasedMovies(now: Date): SQL {
  return exists(unreleasedMovieRow(now));
}
