import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, asc, eq, gte, isNull, lt, max, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MediaType } from '@/common/enums/media-type.enum';
import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import { anyOf } from '@/database/sql-conditions';
import {
  type AnticipatedShowsImportQuery,
  type AnticipatedShowsRefreshQuery,
  type IAnticipatedShowsRepository,
} from '@/modules/ingestion/domain/repositories/anticipated-shows.repository.interface';
import { type AnticipatedShowRanking } from '@/modules/trakt/public';

@Injectable()
export class AnticipatedShowsRepository implements IAnticipatedShowsRepository {
  private readonly logger = new Logger(AnticipatedShowsRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  replaceSnapshot(shows: readonly AnticipatedShowRanking[], fetchedAt: Date): Promise<void> {
    return withDbError(
      'replace anticipated shows snapshot',
      this.logger,
      () =>
        this.db.transaction(async (tx) => {
          await tx.delete(schema.traktAnticipatedShows);
          if (shows.length === 0) return;
          await tx
            .insert(schema.traktAnticipatedShows)
            .values(shows.map((show) => ({ ...show, fetchedAt })));
        }),
      { count: shows.length },
    );
  }

  async findMissingTmdbIds(query: AnticipatedShowsImportQuery): Promise<number[]> {
    const rows = await withDbError(
      'find anticipated shows missing from the catalog',
      this.logger,
      () =>
        this.db
          .select({ tmdbId: schema.traktAnticipatedShows.tmdbId })
          .from(schema.traktAnticipatedShows)
          .leftJoin(schema.mediaItems, this.joinShow())
          .where(
            and(
              gte(schema.traktAnticipatedShows.listCount, query.minListCount),
              isNull(schema.mediaItems.id),
            ),
          )
          .orderBy(asc(schema.traktAnticipatedShows.rank))
          .limit(query.limit),
      { limit: query.limit },
    );

    return rows.map((row) => row.tmdbId);
  }

  async findTmdbIdsToRefresh(query: AnticipatedShowsRefreshQuery): Promise<number[]> {
    const rows = await withDbError(
      'find anticipated shows to refresh',
      this.logger,
      () =>
        this.db
          .select({ tmdbId: schema.traktAnticipatedShows.tmdbId })
          .from(schema.traktAnticipatedShows)
          .innerJoin(schema.mediaItems, this.joinShow())
          .where(
            and(
              gte(schema.traktAnticipatedShows.listCount, query.minListCount),
              isNull(schema.mediaItems.deletedAt),
              anyOf(
                isNull(schema.mediaItems.lastSyncedAt),
                lt(schema.mediaItems.lastSyncedAt, query.syncedBefore),
              ),
            ),
          )
          .orderBy(
            sql`${schema.mediaItems.lastSyncedAt} asc nulls first`,
            asc(schema.traktAnticipatedShows.rank),
          )
          .limit(query.limit),
      { limit: query.limit },
    );

    return rows.map((row) => row.tmdbId);
  }

  async findLatestFetchedAt(): Promise<Date | null> {
    const rows = await withDbError('find latest anticipated shows fetch', this.logger, () =>
      this.db
        .select({ fetchedAt: max(schema.traktAnticipatedShows.fetchedAt) })
        .from(schema.traktAnticipatedShows),
    );

    return rows[0]?.fetchedAt ?? null;
  }

  private joinShow() {
    return and(
      eq(schema.mediaItems.tmdbId, schema.traktAnticipatedShows.tmdbId),
      eq(schema.mediaItems.type, MediaType.SHOW),
    );
  }
}
