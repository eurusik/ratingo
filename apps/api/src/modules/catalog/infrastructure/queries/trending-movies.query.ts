import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, gte, desc, isNotNull, inArray, and } from 'drizzle-orm';
import { ImageMapper } from '../mappers/image.mapper';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

/**
 * Options for trending movies query.
 */
export interface TrendingMoviesOptions {
  limit?: number;
  offset?: number;
  minRating?: number;
  genreId?: string;
  sort?: 'popularity' | 'ratingo' | 'releaseDate';
}

/**
 * Fetches trending movies sorted by popularity and rating.
 *
 * Retrieves movies with stats, external ratings, and genres,
 * applying optional filters for rating and genre.
 *
 * @throws {DatabaseException} When database query fails
 */
@Injectable()
export class TrendingMoviesQuery {
  private readonly logger = new Logger(TrendingMoviesQuery.name);

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
    ingestionStatus: schema.mediaItems.ingestionStatus,
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
   * Executes the trending movies query.
   *
   * @param {TrendingMoviesOptions} options - Query options (limit, offset, filters)
   * @returns {Promise<any[]>} List of trending movies with stats and genres
   * @throws {DatabaseException} When database query fails
   */
  async execute(options: TrendingMoviesOptions): Promise<any[]> {
    const { limit = 20, offset = 0, minRating, genreId, sort } = options;

    try {
      const conditions: any[] = [isNotNull(schema.mediaStats.popularityScore)];

      if (minRating) {
        conditions.push(gte(schema.mediaStats.ratingoScore, minRating));
      }

      if (genreId) {
        const genreSubquery = this.db
          .select({ mediaItemId: schema.mediaGenres.mediaItemId })
          .from(schema.mediaGenres)
          .where(eq(schema.mediaGenres.genreId, genreId));

        conditions.push(inArray(schema.mediaItems.id, genreSubquery));
      }

      const results = await this.db
        .select(this.selectFields)
        .from(schema.movies)
        .innerJoin(schema.mediaItems, eq(schema.movies.mediaItemId, schema.mediaItems.id))
        .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
        .where(and(...conditions))
        .orderBy(
          ...(sort === 'ratingo'
            ? [desc(schema.mediaStats.ratingoScore), desc(schema.mediaItems.popularity)]
            : sort === 'releaseDate'
              ? [desc(schema.mediaItems.releaseDate), desc(schema.mediaItems.popularity)]
              : [desc(schema.mediaStats.popularityScore), desc(schema.mediaItems.popularity)]),
        )
        .limit(limit)
        .offset(offset);

      const moviesWithGenres = await this.attachGenres(results);
      return this.mapResults(moviesWithGenres);
    } catch (error) {
      this.logger.error(`Failed to find trending movies: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to fetch trending movies', {
        originalError: error.message,
      });
    }
  }

  /**
   * Maps movies with isNew and isClassic flags.
   */
  private mapResults(movies: any[]): any[] {
    const now = new Date();
    const newReleaseCutoff = new Date(now);
    newReleaseCutoff.setDate(now.getDate() - 60);

    const classicCutoff = new Date(now);
    classicCutoff.setFullYear(now.getFullYear() - 10);

    return movies.map((m) => ({
      ...m,
      isNew: m.releaseDate ? m.releaseDate >= newReleaseCutoff : false,
      isClassic: m.releaseDate
        ? m.releaseDate <= classicCutoff ||
          ((m.stats.ratingoScore || 0) >= 80 && (m.stats.totalWatchers || 0) > 10000)
        : false,
    }));
  }

  /**
   * Attaches genres to movies in a single batch query.
   */
  private async attachGenres(movies: any[]): Promise<any[]> {
    if (movies.length === 0) return [];

    const mediaItemIds = movies.map((m) => m.mediaItemId);

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
    genresData.forEach((g) => {
      if (!genresMap.has(g.mediaItemId)) genresMap.set(g.mediaItemId, []);
      genresMap.get(g.mediaItemId)!.push({ id: g.id, name: g.name, slug: g.slug });
    });

    return movies.map((m) => ({
      id: m.id,
      mediaItemId: m.mediaItemId,
      tmdbId: m.tmdbId,
      title: m.title,
      slug: m.slug,
      overview: m.overview,
      ingestionStatus: m.ingestionStatus,
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
    }));
  }
}
