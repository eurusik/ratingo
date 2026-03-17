import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, inArray, isNotNull, isNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type IMediaLookupPort } from '../../domain/ports/media-lookup.port';

// Self-contained: depends only on DatabaseModule (global), no CatalogModule needed.
@Injectable()
export class DrizzleMediaLookupAdapter implements IMediaLookupPort {
  private readonly logger = new Logger(DrizzleMediaLookupAdapter.name);

  private static readonly LOOKUP_CHUNK_SIZE = 500;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async findManyByImdbIds(
    imdbIds: string[],
  ): Promise<Array<{ id: string; imdbId: string; type: string }>> {
    if (imdbIds.length === 0) return [];

    const allRows: Array<{ id: string; imdbId: string | null; type: string }> = [];
    for (let i = 0; i < imdbIds.length; i += DrizzleMediaLookupAdapter.LOOKUP_CHUNK_SIZE) {
      const chunk = imdbIds.slice(i, i + DrizzleMediaLookupAdapter.LOOKUP_CHUNK_SIZE);
      const rows = await this.db
        .select({
          id: schema.mediaItems.id,
          imdbId: schema.mediaItems.imdbId,
          type: schema.mediaItems.type,
        })
        .from(schema.mediaItems)
        .where(
          and(
            inArray(schema.mediaItems.imdbId, chunk),
            isNotNull(schema.mediaItems.imdbId),
            isNull(schema.mediaItems.deletedAt),
          ),
        );
      allRows.push(...rows);
    }

    // Detect data quality issues: same IMDB ID mapped to multiple catalog entries
    const seen = new Map<string, number>();
    for (const row of allRows) {
      const count = (seen.get(row.imdbId!) ?? 0) + 1;
      seen.set(row.imdbId!, count);
      if (count === 2) {
        this.logger.warn(
          `Duplicate IMDB ID in catalog: ${row.imdbId} — data quality issue, first match will be used`,
        );
      }
    }

    return allRows.map((r) => ({ id: r.id, imdbId: r.imdbId!, type: r.type }));
  }

  async findManyByTmdbIds(
    tmdbIds: number[],
  ): Promise<Array<{ id: string; tmdbId: number; type: string }>> {
    if (tmdbIds.length === 0) return [];

    const allRows: Array<{ id: string; tmdbId: number | null; type: string }> = [];
    for (let i = 0; i < tmdbIds.length; i += DrizzleMediaLookupAdapter.LOOKUP_CHUNK_SIZE) {
      const chunk = tmdbIds.slice(i, i + DrizzleMediaLookupAdapter.LOOKUP_CHUNK_SIZE);
      const rows = await this.db
        .select({
          id: schema.mediaItems.id,
          tmdbId: schema.mediaItems.tmdbId,
          type: schema.mediaItems.type,
        })
        .from(schema.mediaItems)
        .where(
          and(
            inArray(schema.mediaItems.tmdbId, chunk),
            isNotNull(schema.mediaItems.tmdbId),
            isNull(schema.mediaItems.deletedAt),
          ),
        );
      allRows.push(...rows);
    }

    return allRows.map((r) => ({ id: r.id, tmdbId: r.tmdbId!, type: r.type }));
  }
}
