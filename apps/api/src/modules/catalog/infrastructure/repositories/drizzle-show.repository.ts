import { Inject, Injectable } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '@/database/schema';
import { eq } from 'drizzle-orm';
import { MediaType } from '@/common/enums/media-type.enum';
import { IShowRepository, ShowListItem } from '../../domain/repositories/show.repository.interface';
import { DropOffAnalysis } from '@/modules/shared/drop-off-analyzer';

/**
 * Drizzle implementation of IShowRepository.
 * Handles show-specific database operations.
 */
@Injectable()
export class DrizzleShowRepository implements IShowRepository {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Gets shows for drop-off analysis.
   */
  async findShowsForAnalysis(limit: number): Promise<ShowListItem[]> {
    const shows = await this.db
      .select({
        tmdbId: schema.mediaItems.tmdbId,
        title: schema.mediaItems.title,
      })
      .from(schema.mediaItems)
      .innerJoin(schema.shows, eq(schema.shows.mediaItemId, schema.mediaItems.id))
      .where(eq(schema.mediaItems.type, MediaType.SHOW))
      .limit(limit);

    return shows;
  }

  /**
   * Saves drop-off analysis for a show.
   * Uses single query with subquery for efficiency.
   */
  async saveDropOffAnalysis(tmdbId: number, analysis: DropOffAnalysis): Promise<void> {
    await this.db
      .update(schema.shows)
      .set({ dropOffAnalysis: analysis })
      .where(
        eq(
          schema.shows.mediaItemId,
          this.db
            .select({ id: schema.mediaItems.id })
            .from(schema.mediaItems)
            .where(eq(schema.mediaItems.tmdbId, tmdbId))
            .limit(1)
        )
      );
  }

  /**
   * Gets drop-off analysis for a show by TMDB ID.
   */
  async getDropOffAnalysis(tmdbId: number): Promise<DropOffAnalysis | null> {
    const result = await this.db
      .select({ dropOffAnalysis: schema.shows.dropOffAnalysis })
      .from(schema.shows)
      .innerJoin(schema.mediaItems, eq(schema.shows.mediaItemId, schema.mediaItems.id))
      .where(eq(schema.mediaItems.tmdbId, tmdbId))
      .limit(1);

    return result[0]?.dropOffAnalysis || null;
  }
}
