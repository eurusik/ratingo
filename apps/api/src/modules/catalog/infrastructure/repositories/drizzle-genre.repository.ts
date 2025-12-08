import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '@/database/schema';
import { inArray } from 'drizzle-orm';
import { DatabaseException } from '@/common/exceptions';
import { IGenreRepository, GenreData, DbTransaction } from '../../domain/repositories/genre.repository.interface';

/**
 * Drizzle implementation of IGenreRepository.
 * Handles genre-related database operations.
 */
@Injectable()
export class DrizzleGenreRepository implements IGenreRepository {
  private readonly logger = new Logger(DrizzleGenreRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Syncs genres for a media item within a transaction.
   * Ensures genres exist in registry and links them to the media item.
   */
  async syncGenres(
    tx: DbTransaction,
    mediaId: string,
    genres: GenreData[],
  ): Promise<void> {
    if (genres.length === 0) return;

    try {
      // Ensure genres exist in registry
      await tx
        .insert(schema.genres)
        .values(genres.map((g) => ({
          tmdbId: g.tmdbId,
          name: g.name,
          slug: g.slug,
        })))
        .onConflictDoNothing();

      // Get internal Genre IDs
      const genreIds = await tx
        .select({ id: schema.genres.id })
        .from(schema.genres)
        .where(inArray(schema.genres.tmdbId, genres.map((g) => g.tmdbId)));

      if (genreIds.length > 0) {
        // Link genres to media
        await tx
          .insert(schema.mediaGenres)
          .values(genreIds.map((g) => ({
            mediaItemId: mediaId,
            genreId: g.id,
          })))
          .onConflictDoNothing();
      }
    } catch (error) {
      this.logger.error(`Failed to sync genres for media ${mediaId}: ${error.message}`);
      throw new DatabaseException(`Failed to sync genres: ${error.message}`, { mediaId });
    }
  }
}
