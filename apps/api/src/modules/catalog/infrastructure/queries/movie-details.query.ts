import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq } from 'drizzle-orm';
import { MovieStatus } from '../../../../common/enums/movie-status.enum';
import { CreditsMapper } from '../mappers/credits.mapper';
import { ImageMapper } from '../mappers/image.mapper';
import { WatchProvidersMapper } from '../mappers/watch-providers.mapper';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

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
  ) {}

  /**
   * Executes the movie details query.
   *
   * @param {string} slug - URL-friendly movie identifier
   * @returns {Promise<any | null>} Full movie details or null if not found
   * @throws {DatabaseException} When database query fails
   */
  async execute(slug: string): Promise<any | null> {
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
        .leftJoin(schema.movies, eq(schema.mediaItems.id, schema.movies.mediaItemId))
        .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
        .where(eq(schema.mediaItems.slug, slug))
        .limit(1);

      if (result.length === 0) return null;
      const movie = result[0];

      const genres = await this.fetchGenres(movie.id);

      return {
        id: movie.id,
        tmdbId: movie.tmdbId,
        title: movie.title,
        originalTitle: movie.originalTitle,
        slug: movie.slug,
        overview: movie.overview,
        ingestionStatus: movie.ingestionStatus,
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

  /**
   * Fetches genres for a media item.
   */
  private async fetchGenres(mediaItemId: string) {
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
}
