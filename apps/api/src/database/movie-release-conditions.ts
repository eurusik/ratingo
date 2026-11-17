import { and, eq, gt, notExists, sql, type SQL } from 'drizzle-orm';

import * as schema from './schema';

export function effectiveMovieReleaseDate(): SQL<Date | null> {
  return sql<Date | null>`coalesce(${schema.movies.theatricalReleaseDate}, ${schema.movies.digitalReleaseDate}, ${schema.mediaItems.releaseDate})`;
}

export function isNotUnreleasedMovie(now: Date): SQL {
  return notExists(
    sql`(select 1 from ${schema.movies} where ${and(
      eq(schema.movies.mediaItemId, schema.mediaItems.id),
      gt(effectiveMovieReleaseDate(), now.toISOString()),
    )})`,
  );
}
