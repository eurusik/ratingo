import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, desc, eq, isNotNull, lte } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  type AiredEpisode,
  type ITrackedShowRepository,
  type TrackedShow,
} from '../../domain/repositories/tracked-show.repository.interface';

@Injectable()
export class TrackedShowRepository implements ITrackedShowRepository {
  private readonly logger = new Logger(TrackedShowRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async findByTmdbId(tmdbId: number): Promise<TrackedShow | null> {
    const [show] = await withDbError(
      'find tracked show',
      this.logger,
      () =>
        this.db
          .select({
            mediaItemId: schema.mediaItems.id,
            status: schema.shows.status,
            totalSeasons: schema.shows.totalSeasons,
            nextAirDate: schema.shows.nextAirDate,
          })
          .from(schema.mediaItems)
          .innerJoin(schema.shows, eq(schema.shows.mediaItemId, schema.mediaItems.id))
          .where(
            and(eq(schema.mediaItems.tmdbId, tmdbId), eq(schema.mediaItems.type, MediaType.SHOW)),
          )
          .limit(1),
      { tmdbId },
    );

    return show ?? null;
  }

  async findLatestEpisodeAiredBy(tmdbId: number, airedBy: Date): Promise<AiredEpisode | null> {
    const [episode] = await withDbError(
      'find latest aired episode',
      this.logger,
      () =>
        this.db
          .select({
            seasonNumber: schema.seasons.number,
            episodeNumber: schema.episodes.number,
            airDate: schema.episodes.airDate,
          })
          .from(schema.episodes)
          .innerJoin(schema.seasons, eq(schema.seasons.id, schema.episodes.seasonId))
          .innerJoin(schema.shows, eq(schema.shows.id, schema.seasons.showId))
          .innerJoin(schema.mediaItems, eq(schema.mediaItems.id, schema.shows.mediaItemId))
          .where(
            and(
              eq(schema.mediaItems.tmdbId, tmdbId),
              isNotNull(schema.episodes.airDate),
              lte(schema.episodes.airDate, airedBy),
            ),
          )
          .orderBy(desc(schema.seasons.number), desc(schema.episodes.number))
          .limit(1),
      { tmdbId },
    );

    return episode ?? null;
  }
}
