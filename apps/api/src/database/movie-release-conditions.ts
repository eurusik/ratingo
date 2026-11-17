import { and, eq, exists, gt, gte, notExists, sql, type SQL } from 'drizzle-orm';

import * as schema from './schema';

export function effectiveMovieReleaseDate(): SQL<Date | null> {
  return sql<Date | null>`coalesce(${schema.movies.theatricalReleaseDate}, ${schema.movies.digitalReleaseDate}, ${schema.mediaItems.releaseDate})`;
}

function movieRowReleasing(releaseCondition: SQL): SQL {
  return sql`(select 1 from ${schema.movies} where ${and(
    eq(schema.movies.mediaItemId, schema.mediaItems.id),
    releaseCondition,
  )})`;
}

export function excludeUnreleasedMovies(now: Date): SQL {
  return notExists(movieRowReleasing(gt(effectiveMovieReleaseDate(), now.toISOString())));
}

export function onlyMoviesReleasingFrom(day: Date): SQL {
  return exists(movieRowReleasing(gte(effectiveMovieReleaseDate(), day.toISOString())));
}
