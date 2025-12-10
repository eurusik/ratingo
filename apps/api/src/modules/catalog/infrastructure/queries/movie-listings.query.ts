import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, gte, lte, desc, isNotNull, inArray, and } from 'drizzle-orm';
import { MovieWithMedia } from '../../domain/repositories/movie.repository.interface';
import { ImageMapper } from '../mappers/image.mapper';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

/**
 * Type of movie listing to fetch.
 */
export type MovieListingType = 'now_playing' | 'new_releases' | 'new_on_digital';

/**
 * Options for movie listings query.
 */
export interface MovieListingOptions {
  limit?: number;
  offset?: number;
  daysBack?: number;
}

/**
 * Fetches movie listings by type (Now Playing, New Releases, New on Digital).
 *
 * Consolidates similar queries with different filters into a single
 * reusable query object with type-based filtering.
 *
 * @throws {DatabaseException} When database query fails
 */
@Injectable()
export class MovieListingsQuery {
  private readonly logger = new Logger(MovieListingsQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  private readonly selectFields = {
    id: schema.movies.id,
    mediaItemId: schema.movies.mediaItemId,
    tmdbId: schema.mediaItems.tmdbId,
    title: schema.mediaItems.title,
    slug: schema.mediaItems.slug,
    overview: schema.mediaItems.overview,
    posterPath: schema.mediaItems.posterPath,
    backdropPath: schema.mediaItems.backdropPath,
    popularity: schema.mediaItems.popularity,
    rating: schema.mediaItems.rating,
    voteCount: schema.mediaItems.voteCount,
    releaseDate: schema.mediaItems.releaseDate,
    
    ratingImdb: schema.mediaItems.ratingImdb,
    voteCountImdb: schema.mediaItems.voteCountImdb,
    ratingTrakt: schema.mediaItems.ratingTrakt,
    voteCountTrakt: schema.mediaItems.voteCountTrakt,
    ratingMetacritic: schema.mediaItems.ratingMetacritic,
    ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,

    theatricalReleaseDate: schema.movies.theatricalReleaseDate,
    digitalReleaseDate: schema.movies.digitalReleaseDate,
    runtime: schema.movies.runtime,
    ratingoScore: schema.mediaStats.ratingoScore,
    qualityScore: schema.mediaStats.qualityScore,
    popularityScore: schema.mediaStats.popularityScore,
    watchersCount: schema.mediaStats.watchersCount,
    totalWatchers: schema.mediaStats.totalWatchers,
  };

  /**
   * Executes the movie listings query.
   *
   * @param {MovieListingType} type - Type of listing (now_playing, new_releases, new_on_digital)
   * @param {MovieListingOptions} options - Query options (limit, offset, daysBack)
   * @returns {Promise<MovieWithMedia[]>} List of movies matching the criteria
   * @throws {DatabaseException} When database query fails
   */
  async execute(type: MovieListingType, options: MovieListingOptions = {}): Promise<MovieWithMedia[]> {
    const { limit = 20, offset = 0, daysBack } = options;

    try {
      const { conditions, orderBy } = this.buildQueryParams(type, daysBack);

      const results = await this.db
        .select(this.selectFields)
        .from(schema.movies)
        .innerJoin(schema.mediaItems, eq(schema.movies.mediaItemId, schema.mediaItems.id))
        .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
        .where(and(...conditions))
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset);

      return this.attachGenres(results);
    } catch (error) {
      this.logger.error(`Failed to find ${type} movies: ${error.message}`, error.stack);
      throw new DatabaseException(`Failed to fetch ${type} movies`, { originalError: error.message });
    }
  }

  /**
   * Builds query conditions and order based on listing type.
   */
  private buildQueryParams(type: MovieListingType, daysBack?: number) {
    const now = new Date();

    switch (type) {
      case 'now_playing':
        return {
          conditions: [eq(schema.movies.isNowPlaying, true)],
          orderBy: desc(schema.mediaItems.popularity),
        };

      case 'new_releases': {
        const cutoffDate = new Date();
        cutoffDate.setDate(now.getDate() - (daysBack ?? 30));
        return {
          conditions: [
            isNotNull(schema.movies.theatricalReleaseDate),
            gte(schema.movies.theatricalReleaseDate, cutoffDate),
            lte(schema.movies.theatricalReleaseDate, now),
          ],
          orderBy: desc(schema.movies.theatricalReleaseDate),
        };
      }

      case 'new_on_digital': {
        const cutoffDate = new Date(now.getTime() - (daysBack ?? 14) * 24 * 60 * 60 * 1000);
        return {
          conditions: [
            isNotNull(schema.movies.digitalReleaseDate),
            gte(schema.movies.digitalReleaseDate, cutoffDate),
            lte(schema.movies.digitalReleaseDate, now),
          ],
          orderBy: desc(schema.movies.digitalReleaseDate),
        };
      }
    }
  }

  /**
   * Attaches genres to movies in a single batch query.
   */
  private async attachGenres(movies: any[]): Promise<MovieWithMedia[]> {
    if (movies.length === 0) return [];

    const mediaItemIds = movies.map(m => m.mediaItemId);
    
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

    const genresMap = new Map<string, any[]>();
    genresData.forEach(g => {
      if (!genresMap.has(g.mediaItemId)) genresMap.set(g.mediaItemId, []);
      genresMap.get(g.mediaItemId)!.push({ id: g.id, name: g.name, slug: g.slug });
    });

    return movies.map(m => ({
      id: m.id,
      mediaItemId: m.mediaItemId,
      tmdbId: m.tmdbId,
      title: m.title,
      slug: m.slug,
      overview: m.overview,
      poster: ImageMapper.toPoster(m.posterPath),
      backdrop: ImageMapper.toBackdrop(m.backdropPath),
      popularity: m.popularity,
      releaseDate: m.releaseDate,
      theatricalReleaseDate: m.theatricalReleaseDate,
      digitalReleaseDate: m.digitalReleaseDate,
      runtime: m.runtime,

      stats: {
        ratingoScore: m.ratingoScore,
        qualityScore: m.qualityScore,
        popularityScore: m.popularityScore,
        liveWatchers: m.watchersCount,
        totalWatchers: m.totalWatchers,
      },
      externalRatings: {
        tmdb: { rating: m.rating, voteCount: m.voteCount },
        imdb: m.ratingImdb ? { rating: m.ratingImdb, voteCount: m.voteCountImdb } : null,
        trakt: m.ratingTrakt ? { rating: m.ratingTrakt, voteCount: m.voteCountTrakt } : null,
        metacritic: m.ratingMetacritic ? { rating: m.ratingMetacritic } : null,
        rottenTomatoes: m.ratingRottenTomatoes ? { rating: m.ratingRottenTomatoes } : null,
      },

      genres: genresMap.get(m.mediaItemId) || [],
    })) as MovieWithMedia[];
  }
}
