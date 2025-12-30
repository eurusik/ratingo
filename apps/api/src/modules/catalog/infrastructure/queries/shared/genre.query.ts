import { Inject, Injectable } from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { DATABASE_CONNECTION } from '../../../../../database/database.module';
import * as schema from '../../../../../database/schema';
import type { GenreInfo } from '../../../domain/types/common.types';

/**
 * Shared genre query utilities.
 * Eliminates duplication between MovieDetailsQuery and ShowDetailsQuery.
 */
@Injectable()
export class GenreQuery {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Fetches genres for a single media item.
   *
   * @param mediaItemId - Media item ID
   * @returns Array of genre info
   */
  async fetchForMediaItem(mediaItemId: string): Promise<GenreInfo[]> {
    return this.db
      .select({
        id: schema.genres.id,
        name: schema.genres.name,
        slug: schema.genres.slug,
      })
      .from(schema.genres)
      .innerJoin(schema.mediaGenres, eq(schema.genres.id, schema.mediaGenres.genreId))
      .where(eq(schema.mediaGenres.mediaItemId, mediaItemId));
  }

  /**
   * Fetches genres for multiple media items in a single batch query.
   * Returns a map of mediaItemId -> genres array.
   *
   * @param mediaItemIds - Array of media item IDs
   * @returns Map of mediaItemId to genres array
   */
  async fetchForMediaItems(mediaItemIds: string[]): Promise<Map<string, GenreInfo[]>> {
    if (mediaItemIds.length === 0) {
      return new Map();
    }

    const genresData = await this.db
      .select({
        mediaItemId: schema.mediaGenres.mediaItemId,
        id: schema.genres.id,
        name: schema.genres.name,
        slug: schema.genres.slug,
      })
      .from(schema.mediaGenres)
      .innerJoin(schema.genres, eq(schema.mediaGenres.genreId, schema.genres.id))
      .where(inArray(schema.mediaGenres.mediaItemId, mediaItemIds));

    const genresMap = new Map<string, GenreInfo[]>();

    for (const g of genresData) {
      const existing = genresMap.get(g.mediaItemId) || [];
      existing.push({ id: g.id, name: g.name, slug: g.slug });
      genresMap.set(g.mediaItemId, existing);
    }

    return genresMap;
  }
}
