import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, desc, eq, exists, gt, isNull, lte } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { MediaType } from '@/common/enums/media-type.enum';
import { firstOrUndefined } from '@/common/utils/array.utils';
import { withDbError } from '@/common/utils/db-error.utils';
import { errorMessage } from '@/common/utils/error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import { SPECIALS_SEASON_NUMBER } from '@/modules/user-actions/domain/constants/subscription.constants';
import {
  type IShowStatePort,
  type ShowPremiereFacts,
} from '@/modules/user-actions/domain/ports/show-state.port';

@Injectable()
export class DrizzleShowStateAdapter implements IShowStatePort {
  private readonly logger = new Logger(DrizzleShowStateAdapter.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async getLastAiredEpisodeKey(mediaItemId: string): Promise<string | null> {
    try {
      const result = await this.db
        .select({
          seasonNumber: schema.seasons.number,
          episodeNumber: schema.episodes.number,
        })
        .from(schema.episodes)
        .innerJoin(schema.seasons, eq(schema.seasons.id, schema.episodes.seasonId))
        .innerJoin(schema.shows, eq(schema.shows.id, schema.seasons.showId))
        .where(
          and(eq(schema.shows.mediaItemId, mediaItemId), lte(schema.episodes.airDate, new Date())),
        )
        .orderBy(desc(schema.seasons.number), desc(schema.episodes.number))
        .limit(1);

      if (result.length === 0) return null;

      const ep = result[0];
      return `S${ep.seasonNumber}E${ep.episodeNumber}`;
    } catch (error) {
      const msg = errorMessage(error);
      this.logger.warn(`Failed to get show state for ${mediaItemId}: ${msg}`);
      return null;
    }
  }

  findShowPremiereFacts(mediaItemId: string, asOf: Date): Promise<ShowPremiereFacts | null> {
    return withDbError(
      'find show premiere facts',
      this.logger,
      async () => {
        const rows = await this.db
          .select({
            firstAirDate: schema.mediaItems.releaseDate,
            status: schema.shows.status,
            hasAiredEpisode: exists(this.airedEpisodes(asOf)).mapWith(Boolean),
          })
          .from(schema.mediaItems)
          .innerJoin(schema.shows, eq(schema.shows.mediaItemId, schema.mediaItems.id))
          .where(
            and(
              eq(schema.mediaItems.id, mediaItemId),
              eq(schema.mediaItems.type, MediaType.SHOW),
              isNull(schema.mediaItems.deletedAt),
            ),
          )
          .limit(1);
        return firstOrUndefined(rows) ?? null;
      },
      { mediaItemId },
    );
  }

  private airedEpisodes(asOf: Date) {
    return this.db
      .select({ id: schema.episodes.id })
      .from(schema.episodes)
      .innerJoin(schema.seasons, eq(schema.seasons.id, schema.episodes.seasonId))
      .where(
        and(
          eq(schema.seasons.showId, schema.shows.id),
          gt(schema.seasons.number, SPECIALS_SEASON_NUMBER),
          lte(schema.episodes.airDate, asOf),
        ),
      );
  }
}
