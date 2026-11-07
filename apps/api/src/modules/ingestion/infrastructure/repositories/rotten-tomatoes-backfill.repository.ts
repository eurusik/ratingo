import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, eq, gt, isNotNull, isNull, lt } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { firstOrUndefined } from '@/common/utils/array.utils';
import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import { anyOf } from '@/database/sql-conditions';
import { type BackfillPage } from '@/modules/ingestion/domain/repositories/backfill-page.interface';
import {
  type IRottenTomatoesBackfillRepository,
  type RottenTomatoesBackfillCandidate,
  type RottenTomatoesFetchResult,
} from '@/modules/ingestion/domain/repositories/rotten-tomatoes-backfill.repository.interface';

@Injectable()
export class RottenTomatoesBackfillRepository implements IRottenTomatoesBackfillRepository {
  private readonly logger = new Logger(RottenTomatoesBackfillRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  findCandidates({
    cursor,
    limit,
    fetchedBefore,
  }: BackfillPage & { fetchedBefore: Date }): Promise<RottenTomatoesBackfillCandidate[]> {
    const conditions = [
      isNotNull(schema.mediaItems.tmdbId),
      isNull(schema.mediaItems.deletedAt),
      anyOf(
        isNull(schema.mediaItems.ratingRottenTomatoes),
        isNull(schema.mediaItems.ratingRottenTomatoesAudience),
      ),
      anyOf(
        isNull(schema.mediaItems.rtFetchedAt),
        lt(schema.mediaItems.rtFetchedAt, fetchedBefore),
      ),
    ];

    if (cursor) {
      conditions.push(gt(schema.mediaItems.id, cursor));
    }

    return withDbError('find MDBList backfill candidates', this.logger, () =>
      this.db
        .select({
          id: schema.mediaItems.id,
          tmdbId: schema.mediaItems.tmdbId,
          type: schema.mediaItems.type,
        })
        .from(schema.mediaItems)
        .where(and(...conditions))
        .orderBy(schema.mediaItems.id)
        .limit(limit),
    );
  }

  async findLastFetchedAt(mediaItemId: string): Promise<Date | null> {
    const existing = firstOrUndefined(
      await withDbError(
        'read MDBList rtFetchedAt',
        this.logger,
        () =>
          this.db
            .select({ rtFetchedAt: schema.mediaItems.rtFetchedAt })
            .from(schema.mediaItems)
            .where(eq(schema.mediaItems.id, mediaItemId))
            .limit(1),
        { mediaItemId },
      ),
    );

    return existing?.rtFetchedAt ?? null;
  }

  async saveFetchResult(mediaItemId: string, result: RottenTomatoesFetchResult): Promise<void> {
    const { fetchedAt, ratings, ratingsChangedAt } = result;
    const update: Partial<typeof schema.mediaItems.$inferInsert> = { rtFetchedAt: fetchedAt };

    if (ratings.rottenTomatoesCritics != null) {
      update.ratingRottenTomatoes = ratings.rottenTomatoesCritics;
    }
    if (ratings.rottenTomatoesAudience != null) {
      update.ratingRottenTomatoesAudience = ratings.rottenTomatoesAudience;
    }
    if (ratingsChangedAt) {
      update.updatedAt = ratingsChangedAt;
    }

    await withDbError(
      'persist MDBList RT ratings',
      this.logger,
      () =>
        this.db.update(schema.mediaItems).set(update).where(eq(schema.mediaItems.id, mediaItemId)),
      { mediaItemId },
    );
  }
}
