import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, and, isNull } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { DatabaseException } from '../../../../common/exceptions';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { type MovieDetails } from '../../domain/repositories';

import {
  GenreQuery,
  MOVIE_DETAILS_SELECT_FIELDS,
  type MovieDetailsQueryRow,
  mapMovieDetails,
  WatchOffersQuery,
  RecentRatersQuery,
} from './shared';

/**
 * Fetches complete movie details by slug.
 *
 * Retrieves movie metadata, stats, external ratings, and genres
 * with optimized database queries.
 *
 * @throws {DatabaseException} When database query fails
 */
@Injectable()
export class MovieDetailsQuery {
  private readonly logger = new Logger(MovieDetailsQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly genreQuery: GenreQuery,
    private readonly watchOffersQuery: WatchOffersQuery,
    private readonly recentRatersQuery: RecentRatersQuery,
  ) {}

  /**
   * Executes the movie details query.
   * Returns any ready movie regardless of eligibility status.
   * Detail pages should be accessible for all content.
   *
   * @param {string} slug - URL-friendly movie identifier
   * @returns {Promise<MovieDetails | null>} Full movie details or null if not found
   * @throws {DatabaseException} When database query fails
   */
  async execute(slug: string): Promise<MovieDetails | null> {
    try {
      const result = await this.db
        .select(MOVIE_DETAILS_SELECT_FIELDS)
        .from(schema.mediaItems)
        .innerJoin(schema.movies, eq(schema.mediaItems.id, schema.movies.mediaItemId))
        .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
        .where(
          and(
            eq(schema.mediaItems.slug, slug),
            // Ready filter: only show items with ready ingestion status
            eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
            // Not deleted filter
            isNull(schema.mediaItems.deletedAt),
          ),
        )
        .limit(1);

      if (result.length === 0) return null;
      const movie = result[0] as MovieDetailsQueryRow;

      // Fetch genres, watch offers, and recent raters in parallel
      const [genres, watchOffers, recentRaters] = await Promise.all([
        this.genreQuery.fetchForMediaItem(movie.id),
        this.watchOffersQuery.fetchForMediaItem(movie.id),
        this.recentRatersQuery.fetchForMediaItem(movie.id),
      ]);

      return mapMovieDetails(movie, genres, watchOffers, recentRaters);
    } catch (error) {
      this.logger.error(`Failed to find movie by slug ${slug}: ${error.message}`, error.stack);
      throw new DatabaseException(`Failed to fetch movie ${slug}`, {
        originalError: error.message,
      });
    }
  }
}
