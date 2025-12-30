import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { MovieStatus } from '../../../../common/enums/movie-status.enum';
import { CreditsMapper } from '../mappers/credits.mapper';
import { ImageMapper } from '../../../../common/mappers/image.mapper';
import { WatchProvidersMapper } from '../mappers/watch-providers.mapper';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { MovieDetails } from '../../domain/repositories/movie.repository.interface';
import { GenreQuery } from './shared/genre.query';

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
        .select({
          id: schema.mediaItems.id,
          tmdbId: schema.mediaItems.tmdbId,
          title: schema.mediaItems.title,
          originalTitle: schema.mediaItems.originalTitle,
          slug: schema.mediaItems.slug,
          overview: schema.mediaItems.overview,
          posterPath: schema.mediaItems.posterPath,
          ingestionStatus: schema.mediaItems.ingestionStatus,
          backdropPath: schema.mediaItems.backdropPath,
          rating: schema.mediaItems.rating,
          voteCount: schema.mediaItems.voteCount,
          releaseDate: schema.mediaItems.releaseDate,
          videos: schema.mediaItems.videos,
          credits: schema.mediaItems.credits,
          watchProviders: schema.mediaItems.watchProviders,

          ratingImdb: schema.mediaItems.ratingImdb,
          voteCountImdb: schema.mediaItems.voteCountImdb,
          ratingTrakt: schema.mediaItems.ratingTrakt,
          voteCountTrakt: schema.mediaItems.voteCountTrakt,
          ratingMetacritic: schema.mediaItems.ratingMetacritic,
          ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,

          runtime: schema.movies.runtime,
          budget: schema.movies.budget,
          revenue: schema.movies.revenue,
          status: schema.movies.status,
          theatricalReleaseDate: schema.movies.theatricalReleaseDate,
          digitalReleaseDate: schema.movies.digitalReleaseDate,

          ratingoScore: schema.mediaStats.ratingoScore,
          qualityScore: schema.mediaStats.qualityScore,
          popularityScore: schema.mediaStats.popularityScore,
          watchersCount: schema.mediaStats.watchersCount,
          totalWatchers: schema.mediaStats.totalWatchers,
        })
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
      const movie = result[0];

      const genres = await this.genreQuery.fetchForMediaItem(movie.id);

      return {
        id: movie.id,
        tmdbId: movie.tmdbId,
        title: movie.title,
        originalTitle: movie.originalTitle,
        slug: movie.slug,
        overview: movie.overview,
        ingestionStatus: movie.ingestionStatus as IngestionStatus,
        poster: ImageMapper.toPoster(movie.posterPath),
        backdrop: ImageMapper.toBackdrop(movie.backdropPath),
        releaseDate: movie.releaseDate ?? movie.theatricalReleaseDate ?? null,
        videos: movie.videos,
        primaryTrailer: movie.videos?.[0] || null,
        credits: CreditsMapper.toDto(movie.credits),
        availability: WatchProvidersMapper.toAvailability(movie.watchProviders),

        runtime: movie.runtime ?? null,
        budget: movie.budget ?? null,
        revenue: movie.revenue ?? null,
        status: movie.status ? (movie.status as MovieStatus) : null,
        theatricalReleaseDate: movie.theatricalReleaseDate ?? null,
        digitalReleaseDate: movie.digitalReleaseDate ?? null,

        stats: {
          ratingoScore: movie.ratingoScore,
          qualityScore: movie.qualityScore,
          popularityScore: movie.popularityScore,
          liveWatchers: movie.watchersCount,
          totalWatchers: movie.totalWatchers,
        },
        externalRatings: {
          tmdb: { rating: movie.rating, voteCount: movie.voteCount },
          imdb: movie.ratingImdb
            ? { rating: movie.ratingImdb, voteCount: movie.voteCountImdb }
            : null,
          trakt: movie.ratingTrakt
            ? { rating: movie.ratingTrakt, voteCount: movie.voteCountTrakt }
            : null,
          metacritic: movie.ratingMetacritic ? { rating: movie.ratingMetacritic } : null,
          rottenTomatoes: movie.ratingRottenTomatoes
            ? { rating: movie.ratingRottenTomatoes }
            : null,
        },

        genres,
      };
    } catch (error) {
      this.logger.error(`Failed to find movie by slug ${slug}: ${error.message}`, error.stack);
      throw new DatabaseException(`Failed to fetch movie ${slug}`, {
        originalError: error.message,
      });
    }
  }
}
