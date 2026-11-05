import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, eq, gt, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type RottenTomatoesRatings } from '../../domain/ports/rotten-tomatoes-ratings.port';
import {
  type AltTitlesBackfillCandidate,
  type IMediaBackfillRepository,
  type ImdbBackfillCandidate,
  type RtBackfillCandidate,
} from '../../domain/repositories/media-backfill.repository.interface';

@Injectable()
export class MediaBackfillRepository implements IMediaBackfillRepository {
  private readonly logger = new Logger(MediaBackfillRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  findRtBackfillCandidates(
    staleBefore: Date,
    cursor: string | undefined,
    limit: number,
  ): Promise<RtBackfillCandidate[]> {
    const conditions = [
      isNotNull(schema.mediaItems.tmdbId),
      isNull(schema.mediaItems.deletedAt),
      or(
        isNull(schema.mediaItems.ratingRottenTomatoes),
        isNull(schema.mediaItems.ratingRottenTomatoesAudience),
      )!,
      or(isNull(schema.mediaItems.rtFetchedAt), lt(schema.mediaItems.rtFetchedAt, staleBefore))!,
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

  async findRtFetchedAt(mediaItemId: string, tmdbId: number): Promise<Date | null> {
    const [existing] = await withDbError(
      'read MDBList rtFetchedAt',
      this.logger,
      () =>
        this.db
          .select({ rtFetchedAt: schema.mediaItems.rtFetchedAt })
          .from(schema.mediaItems)
          .where(eq(schema.mediaItems.id, mediaItemId))
          .limit(1),
      { mediaItemId, tmdbId },
    );

    return existing?.rtFetchedAt ?? null;
  }

  async markRtFetched(
    mediaItemId: string,
    tmdbId: number,
    ratings: RottenTomatoesRatings,
  ): Promise<void> {
    const update: Partial<typeof schema.mediaItems.$inferInsert> = {
      rtFetchedAt: new Date(),
    };

    if (ratings.rottenTomatoesCritics != null) {
      update.ratingRottenTomatoes = ratings.rottenTomatoesCritics;
    }
    if (ratings.rottenTomatoesAudience != null) {
      update.ratingRottenTomatoesAudience = ratings.rottenTomatoesAudience;
    }

    const wroteRatings =
      update.ratingRottenTomatoes != null || update.ratingRottenTomatoesAudience != null;
    if (wroteRatings) {
      update.updatedAt = new Date();
    }

    await withDbError(
      'persist MDBList RT ratings',
      this.logger,
      () =>
        this.db.update(schema.mediaItems).set(update).where(eq(schema.mediaItems.id, mediaItemId)),
      { mediaItemId, tmdbId },
    );
  }

  findAltTitlesBackfillCandidates(
    cursor: string | undefined,
    limit: number,
  ): Promise<AltTitlesBackfillCandidate[]> {
    const conditions = [
      isNull(schema.mediaItems.alternativeTitles),
      isNull(schema.mediaItems.deletedAt),
    ];

    if (cursor) {
      conditions.push(gt(schema.mediaItems.id, cursor));
    }

    return withDbError('find alt-titles backfill candidates', this.logger, () =>
      this.db
        .select({
          id: schema.mediaItems.id,
          tmdbId: schema.mediaItems.tmdbId,
          type: schema.mediaItems.type,
          title: schema.mediaItems.title,
          originalTitle: schema.mediaItems.originalTitle,
        })
        .from(schema.mediaItems)
        .where(and(...conditions))
        .orderBy(schema.mediaItems.id)
        .limit(limit),
    );
  }

  findShowsMissingImdbId(
    cursor: string | undefined,
    limit: number,
  ): Promise<ImdbBackfillCandidate[]> {
    const conditions = [
      eq(schema.mediaItems.type, MediaType.SHOW),
      isNull(schema.mediaItems.imdbId),
      isNull(schema.mediaItems.deletedAt),
    ];

    if (cursor) {
      conditions.push(gt(schema.mediaItems.id, cursor));
    }

    return withDbError('find IMDb backfill candidates', this.logger, () =>
      this.db
        .select({
          id: schema.mediaItems.id,
          tmdbId: schema.mediaItems.tmdbId,
        })
        .from(schema.mediaItems)
        .where(and(...conditions))
        .orderBy(schema.mediaItems.id)
        .limit(limit),
    );
  }

  async setShowImdbId(tmdbId: number, imdbId: string): Promise<void> {
    await withDbError(
      'persist IMDb id',
      this.logger,
      () =>
        this.db
          .update(schema.mediaItems)
          .set({ imdbId })
          .where(
            and(eq(schema.mediaItems.tmdbId, tmdbId), eq(schema.mediaItems.type, MediaType.SHOW)),
          ),
      { tmdbId, imdbId },
    );
  }
}
