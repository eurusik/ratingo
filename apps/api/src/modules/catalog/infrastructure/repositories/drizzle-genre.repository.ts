import { Injectable, Logger } from '@nestjs/common';

import { inArray } from 'drizzle-orm';

import { withDbError } from '../../../../common/utils/db-error.utils';
import * as schema from '../../../../database/schema';
import {
  type IGenreRepository,
  type GenreData,
} from '../../domain/repositories/genre.repository.interface';
import { type DatabaseTransaction } from '../../domain/types/transaction.type';
import { GenrePersistenceMapper } from '../mappers/genre-persistence.mapper';
import { toDrizzleTx } from '../utils/drizzle-transaction';

/**
 * Drizzle implementation of IGenreRepository.
 * Handles genre-related database operations within an existing transaction.
 */
@Injectable()
export class DrizzleGenreRepository implements IGenreRepository {
  private readonly logger = new Logger(DrizzleGenreRepository.name);

  /**
   * Syncs genres for a media item within a transaction.
   * Ensures genres exist in registry and links them to the media item.
   */
  async syncGenres(tx: DatabaseTransaction, mediaId: string, genres: GenreData[]): Promise<void> {
    if (genres.length === 0) return;

    const drizzleTx = toDrizzleTx(tx);

    return withDbError(
      'sync genres',
      this.logger,
      async () => {
        // Ensure genres exist in registry
        await drizzleTx
          .insert(schema.genres)
          .values(GenrePersistenceMapper.toGenreInsertValues(genres))
          .onConflictDoNothing();

        // Get internal Genre IDs
        const genreIds = await drizzleTx
          .select({ id: schema.genres.id })
          .from(schema.genres)
          .where(
            inArray(
              schema.genres.tmdbId,
              genres.map((g) => g.tmdbId),
            ),
          );

        if (genreIds.length > 0) {
          // Link genres to media
          await drizzleTx
            .insert(schema.mediaGenres)
            .values(GenrePersistenceMapper.toMediaGenresInsertValues(mediaId, genreIds))
            .onConflictDoNothing();
        }
      },
      { mediaId, genreCount: genres.length },
    );
  }
}
