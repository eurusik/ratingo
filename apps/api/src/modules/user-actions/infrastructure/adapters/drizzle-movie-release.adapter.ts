import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, eq, isNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MediaType } from '@/common/enums/media-type.enum';
import { firstOrUndefined } from '@/common/utils/array.utils';
import { withDbError } from '@/common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import {
  type IMovieReleasePort,
  type MovieReleaseSchedule,
} from '@/modules/user-actions/domain/ports/movie-release.port';

@Injectable()
export class DrizzleMovieReleaseAdapter implements IMovieReleasePort {
  private readonly logger = new Logger(DrizzleMovieReleaseAdapter.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async findMovieReleaseSchedule(mediaItemId: string): Promise<MovieReleaseSchedule | null> {
    return withDbError(
      'find movie release schedule',
      this.logger,
      async () => this.selectSchedule(mediaItemId),
      { mediaItemId },
    );
  }

  private async selectSchedule(mediaItemId: string): Promise<MovieReleaseSchedule | null> {
    const row = firstOrUndefined(
      await this.db
        .select({
          theatricalReleaseDate: schema.movies.theatricalReleaseDate,
          digitalReleaseDate: schema.movies.digitalReleaseDate,
          releaseDate: schema.mediaItems.releaseDate,
        })
        .from(schema.mediaItems)
        .innerJoin(schema.movies, eq(schema.movies.mediaItemId, schema.mediaItems.id))
        .where(
          and(
            eq(schema.mediaItems.id, mediaItemId),
            eq(schema.mediaItems.type, MediaType.MOVIE),
            isNull(schema.mediaItems.deletedAt),
          ),
        )
        .limit(1),
    );
    return row ?? null;
  }
}
