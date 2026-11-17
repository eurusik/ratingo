import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, asc, eq, gt, isNull, lt, lte, sql, type SQL } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MediaType } from '@/common/enums/media-type.enum';
import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { effectiveMovieReleaseDate } from '@/database/movie-release-conditions';
import * as schema from '@/database/schema';
import { anyOf } from '@/database/sql-conditions';
import {
  type IUpcomingMoviesRepository,
  type UpcomingMoviesRefreshQuery,
} from '@/modules/ingestion/domain/repositories/upcoming-movies.repository.interface';

@Injectable()
export class UpcomingMoviesRepository implements IUpcomingMoviesRepository {
  private readonly logger = new Logger(UpcomingMoviesRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async findTmdbIdsToRefresh(query: UpcomingMoviesRefreshQuery): Promise<number[]> {
    const releaseDate = effectiveMovieReleaseDate();
    const conditions: SQL[] = [
      eq(schema.mediaItems.type, MediaType.MOVIE),
      isNull(schema.mediaItems.deletedAt),
      gt(releaseDate, query.releasedAfter.toISOString()),
      anyOf(
        isNull(schema.mediaItems.lastSyncedAt),
        lt(schema.mediaItems.lastSyncedAt, query.syncedBefore),
      ),
    ];

    if (query.releasedBefore) {
      conditions.push(lte(releaseDate, query.releasedBefore.toISOString()));
    }

    const rows = await withDbError(
      'find upcoming movies to refresh',
      this.logger,
      () =>
        this.db
          .select({ tmdbId: schema.mediaItems.tmdbId })
          .from(schema.mediaItems)
          .innerJoin(schema.movies, eq(schema.movies.mediaItemId, schema.mediaItems.id))
          .where(and(...conditions))
          .orderBy(sql`${schema.mediaItems.lastSyncedAt} asc nulls first`, asc(releaseDate))
          .limit(query.limit),
      { limit: query.limit },
    );

    return rows.map((row) => row.tmdbId);
  }
}
