import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, desc, eq, lte } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type IShowStatePort } from '../../domain/ports/show-state.port';

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
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to get show state for ${mediaItemId}: ${msg}`);
      return null;
    }
  }
}
