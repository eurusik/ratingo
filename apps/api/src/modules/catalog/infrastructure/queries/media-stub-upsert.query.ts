import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, eq, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DB_CONSTRAINT } from '@/common/constants/database.constants';
import { IngestionStatus } from '@/common/enums/ingestion-status.enum';
import { DatabaseException } from '@/common/exceptions';
import { extractPgError, isSlugCollision } from '@/common/utils/pg-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import { type IMediaRepository } from '@/modules/catalog/domain/repositories/media.repository.interface';
import { generateUniqueSlug } from '@/modules/catalog/domain/utils/slug.utils';

export type MediaStubPayload = Parameters<IMediaRepository['upsertStub']>[0];

@Injectable()
export class MediaStubUpsertQuery {
  private readonly logger = new Logger(MediaStubUpsertQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Inserts a minimal stub media item (media_items only).
   * If exists, returns existing id/slug without failing.
   *
   * Handles race condition where multiple parallel requests try to insert
   * the same media item. ON CONFLICT handles (type, tmdb_id), but there's
   * also a unique constraint on (type, slug). If slug conflict occurs,
   * we fall back to SELECT by slug and handle accordingly.
   */
  async execute(payload: MediaStubPayload): Promise<{ id: string; slug: string }> {
    try {
      const [row] = await this.db
        .insert(schema.mediaItems)
        .values({
          tmdbId: payload.tmdbId,
          type: payload.type,
          title: payload.title,
          slug: payload.slug,
          ingestionStatus: payload.ingestionStatus,
          // minimal defaults
          popularity: 0,
          rating: 0,
          voteCount: 0,
          credits: { cast: [], crew: [] },
          videos: null,
          watchProvidersRaw: null,
          overview: null,
        })
        .onConflictDoUpdate({
          target: [schema.mediaItems.type, schema.mediaItems.tmdbId], // Composite key: type + tmdb_id
          set: {
            title: payload.title,
            // slug intentionally omitted: preserve collision-resolved slugs (e.g., "sandwich-200")
            // Never downgrade an already READY item (forced re-sync must not hide it)
            ingestionStatus: sql`CASE WHEN ${schema.mediaItems.ingestionStatus} = ${IngestionStatus.READY} THEN ${schema.mediaItems.ingestionStatus} ELSE excluded.ingestion_status END`,
            updatedAt: new Date(),
          },
        })
        .returning({ id: schema.mediaItems.id, slug: schema.mediaItems.slug });

      return row;
    } catch (error: unknown) {
      const result = await this.handleSlugConflict(error, payload);
      if (result) return result;

      // Log full error details for debugging
      const pgError = extractPgError(error);
      this.logger.error(`Failed to upsert stub for tmdbId ${payload.tmdbId}`, {
        message: pgError.message,
        code: pgError.code,
        detail: pgError.detail,
        constraint: pgError.constraint,
      });
      throw new DatabaseException('Failed to upsert stub media item', error, {
        tmdbId: payload.tmdbId,
      });
    }
  }

  /**
   * Handles slug unique constraint violation during upsert.
   * Returns resolved record or null if error is not a slug conflict.
   */
  private async handleSlugConflict(
    error: unknown,
    payload: MediaStubPayload,
  ): Promise<{ id: string; slug: string } | null> {
    // Not a slug collision — let caller handle
    if (!isSlugCollision(error, DB_CONSTRAINT.MEDIA_TYPE_SLUG)) {
      return null;
    }

    // Fetch by slug — that's what we know exists from the error
    const existingBySlug = await this.db
      .select({
        id: schema.mediaItems.id,
        slug: schema.mediaItems.slug,
        tmdbId: schema.mediaItems.tmdbId,
      })
      .from(schema.mediaItems)
      .where(
        and(eq(schema.mediaItems.type, payload.type), eq(schema.mediaItems.slug, payload.slug)),
      )
      .limit(1);

    if (!existingBySlug[0]) {
      return null; // Shouldn't happen, but let caller handle
    }

    // Case 1: Race condition — same tmdbId, just return existing
    if (existingBySlug[0].tmdbId === payload.tmdbId) {
      this.logger.debug(
        `Race condition resolved for tmdbId ${payload.tmdbId}, returning existing record`,
      );
      return { id: existingBySlug[0].id, slug: existingBySlug[0].slug };
    }

    // Case 2: Real slug collision — different tmdbId owns this slug
    return this.upsertWithUniqueSlug(payload, existingBySlug[0].tmdbId);
  }

  /**
   * Retries upsert with a unique slug (appends tmdbId) when slug collision occurs.
   */
  private async upsertWithUniqueSlug(
    payload: MediaStubPayload,
    conflictingTmdbId: number,
  ): Promise<{ id: string; slug: string }> {
    const uniqueSlug = generateUniqueSlug(payload.slug, payload.tmdbId);

    this.logger.warn(
      `Slug collision: "${payload.slug}" owned by tmdbId ${conflictingTmdbId}, ` +
        `using "${uniqueSlug}" for tmdbId ${payload.tmdbId}`,
    );

    const [retryRow] = await this.db
      .insert(schema.mediaItems)
      .values({
        tmdbId: payload.tmdbId,
        type: payload.type,
        title: payload.title,
        slug: uniqueSlug,
        ingestionStatus: payload.ingestionStatus,
        popularity: 0,
        rating: 0,
        voteCount: 0,
        credits: { cast: [], crew: [] },
        videos: null,
        watchProvidersRaw: null,
        overview: null,
      })
      .onConflictDoUpdate({
        target: [schema.mediaItems.type, schema.mediaItems.tmdbId],
        set: {
          title: payload.title,
          slug: uniqueSlug,
          ingestionStatus: payload.ingestionStatus,
          updatedAt: new Date(),
        },
      })
      .returning({ id: schema.mediaItems.id, slug: schema.mediaItems.slug });

    return retryRow;
  }
}
