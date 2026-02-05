import { type InferInsertModel } from 'drizzle-orm';

import type * as schema from '../../../../database/schema';
import type { GenreData } from '../../domain/repositories/genre.repository.interface';

/**
 * Maps domain GenreData to Drizzle insert payloads for persistence operations.
 */
export class GenrePersistenceMapper {
  /**
   * Maps GenreData array to genres table insert values.
   */
  static toGenreInsertValues(genres: GenreData[]): InferInsertModel<typeof schema.genres>[] {
    return genres.map((g) => ({
      tmdbId: g.tmdbId,
      name: g.name,
      slug: g.slug,
    }));
  }

  /**
   * Maps genre IDs to media_genres junction table insert values.
   */
  static toMediaGenresInsertValues(
    mediaId: string,
    genreIds: { id: string }[],
  ): InferInsertModel<typeof schema.mediaGenres>[] {
    return genreIds.map((g) => ({
      mediaItemId: mediaId,
      genreId: g.id,
    }));
  }
}
