import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, asc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { IngestionStatus } from '@/common/enums/ingestion-status.enum';
import { firstOrUndefined } from '@/common/utils/array.utils';
import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import type {
  UpcomingMovie,
  UpcomingMoviesQueryOptions,
  WithTotal,
} from '@/modules/catalog/domain/repositories/movie.repository.interface';
import type { GenreInfo } from '@/modules/catalog/domain/types/common.types';
import {
  type MovieReleaseEntry,
  resolveMovieRelease,
} from '@/modules/catalog/domain/utils/movie-release.utils';
import { EvaluationContext } from '@/modules/catalog-policy/public';

import { GenreQuery } from './shared/genre.query';
import {
  effectiveReleaseWithin,
  eligibleUnderActivePolicy,
} from './shared/movie-release-conditions';
import { MovieResultMapper } from './shared/movie-result.mapper';
import { movieSelectFields, type MovieSelectRow } from './shared/movie-select.fields';

type UpcomingMovieRow = MovieSelectRow & { releases: MovieReleaseEntry[] | null };

const byTmdbPopularityDesc = sql`${schema.mediaItems.popularity} desc nulls last`;

@Injectable()
export class UpcomingMoviesQuery {
  private readonly logger = new Logger(UpcomingMoviesQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly genreQuery: GenreQuery,
  ) {}

  execute(options: UpcomingMoviesQueryOptions): Promise<WithTotal<UpcomingMovie>> {
    const where = and(
      eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
      isNull(schema.mediaItems.deletedAt),
      effectiveReleaseWithin(options),
      eligibleUnderActivePolicy([EvaluationContext.UPCOMING]),
    );

    return withDbError('fetch upcoming movies', this.logger, async () => {
      const [rows, total] = await Promise.all([
        this.fetchRows(where, options),
        this.countTotal(where),
      ]);
      const genresMap = await this.genreQuery.fetchForMediaItems(rows.map((row) => row.id));
      const movies: WithTotal<UpcomingMovie> = rows
        .map((row) => toUpcomingMovie(row, genresMap.get(row.id) ?? []))
        .filter(isUpcomingMovie);
      movies.total = total;
      return movies;
    });
  }

  private fetchRows(
    where: SQL | undefined,
    { limit, offset }: UpcomingMoviesQueryOptions,
  ): Promise<UpcomingMovieRow[]> {
    return this.db
      .select({ ...movieSelectFields, releases: schema.movies.releases })
      .from(schema.movies)
      .innerJoin(schema.mediaItems, eq(schema.movies.mediaItemId, schema.mediaItems.id))
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(where)
      .orderBy(byTmdbPopularityDesc, asc(schema.mediaItems.id))
      .limit(limit)
      .offset(offset);
  }

  private async countTotal(where: SQL | undefined): Promise<number> {
    const row = firstOrUndefined(
      await this.db
        .select({ total: sql<number>`count(*)` })
        .from(schema.movies)
        .innerJoin(schema.mediaItems, eq(schema.movies.mediaItemId, schema.mediaItems.id))
        .where(where),
    );
    return Number(row?.total ?? 0);
  }
}

function toUpcomingMovie(row: UpcomingMovieRow, genres: GenreInfo[]): UpcomingMovie | null {
  const release = resolveMovieRelease(row, row.releases);
  if (!release) return null;
  return {
    ...MovieResultMapper.toMovieWithMedia(row, genres),
    effectiveReleaseDate: release.date,
    releaseDateKind: release.kind,
    releaseCountry: release.country,
  };
}

function isUpcomingMovie(movie: UpcomingMovie | null): movie is UpcomingMovie {
  return movie !== null;
}
