import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, gte, lte, and, desc, isNotNull, inArray } from 'drizzle-orm';
import { 
  IMovieRepository, 
  MovieWithMedia, 
  NowPlayingOptions 
} from '../../domain/repositories/movie.repository.interface';
import { ReleaseInfo } from '../../../../database/schema';
import { MovieStatus } from '../../../../common/enums/movie-status.enum';
import { CreditsMapper } from '../mappers/credits.mapper';
import { ImageMapper } from '../mappers/image.mapper';
import { WatchProvidersMapper } from '../mappers/watch-providers.mapper';

import { PersistenceMapper } from '../mappers/persistence.mapper';

type DbTransaction = Parameters<Parameters<PostgresJsDatabase<typeof schema>['transaction']>[0]>[0];

/**
 * Drizzle implementation of IMovieRepository.
 * Optimized queries for Now Playing, New Releases, and New on Digital.
 */
@Injectable()
export class DrizzleMovieRepository implements IMovieRepository {
  private readonly logger = new Logger(DrizzleMovieRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Upserts movie details transactionally.
   */
  async upsertDetails(
    tx: DbTransaction,
    mediaId: string,
    details: any
  ): Promise<void> {
    await tx
      .insert(schema.movies)
      .values(PersistenceMapper.toMovieInsert(mediaId, details))
      .onConflictDoUpdate({
        target: schema.movies.mediaItemId,
        set: PersistenceMapper.toMovieUpdate(details),
      });
  }

  /**
   * Finds full movie details by slug.
   */
  async findBySlug(slug: string): Promise<any> {
    // Fetch Main Data (Movie + MediaItem + Stats)
    const result = await this.db
      .select({
        // MediaItem
        id: schema.mediaItems.id,
        tmdbId: schema.mediaItems.tmdbId,
        title: schema.mediaItems.title,
        originalTitle: schema.mediaItems.originalTitle,
        slug: schema.mediaItems.slug,
        overview: schema.mediaItems.overview,
        posterPath: schema.mediaItems.posterPath,
        backdropPath: schema.mediaItems.backdropPath,
        rating: schema.mediaItems.rating,
        voteCount: schema.mediaItems.voteCount,
        releaseDate: schema.mediaItems.releaseDate,
        videos: schema.mediaItems.videos,
        credits: schema.mediaItems.credits,
        watchProviders: schema.mediaItems.watchProviders,
        
        // External Ratings
        ratingImdb: schema.mediaItems.ratingImdb,
        voteCountImdb: schema.mediaItems.voteCountImdb,
        ratingTrakt: schema.mediaItems.ratingTrakt,
        voteCountTrakt: schema.mediaItems.voteCountTrakt,
        ratingMetacritic: schema.mediaItems.ratingMetacritic,
        ratingRottenTomatoes: schema.mediaItems.ratingRottenTomatoes,
        
        // Movie Details
        runtime: schema.movies.runtime,
        budget: schema.movies.budget,
        revenue: schema.movies.revenue,
        status: schema.movies.status,
        
        // Stats
        ratingoScore: schema.mediaStats.ratingoScore,
        qualityScore: schema.mediaStats.qualityScore,
        popularityScore: schema.mediaStats.popularityScore,
        watchersCount: schema.mediaStats.watchersCount,
        totalWatchers: schema.mediaStats.totalWatchers,
      })
      .from(schema.mediaItems)
      .innerJoin(schema.movies, eq(schema.mediaItems.id, schema.movies.mediaItemId))
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(eq(schema.mediaItems.slug, slug))
      .limit(1);

    if (result.length === 0) return null;
    const movie = result[0];

    // Fetch Genres
    const genres = await this.db
      .select({
        id: schema.genres.id,
        name: schema.genres.name,
        slug: schema.genres.slug,
      })
      .from(schema.genres)
      .innerJoin(schema.mediaGenres, eq(schema.genres.id, schema.mediaGenres.genreId))
      .where(eq(schema.mediaGenres.mediaItemId, movie.id));

    return {
      // Basic fields
      id: movie.id,
      tmdbId: movie.tmdbId,
      title: movie.title,
      originalTitle: movie.originalTitle,
      slug: movie.slug,
      overview: movie.overview,
      posterPath: movie.posterPath,
      poster: ImageMapper.toPoster(movie.posterPath),
      backdropPath: movie.backdropPath,
      backdrop: ImageMapper.toBackdrop(movie.backdropPath),
      releaseDate: movie.releaseDate,
      videos: movie.videos,
      primaryTrailer: movie.videos?.[0] || null,
      credits: CreditsMapper.toDto(movie.credits),
      availability: WatchProvidersMapper.toAvailability(movie.watchProviders),
      
      // Movie specific
      runtime: movie.runtime,
      budget: movie.budget,
      revenue: movie.revenue,
      status: movie.status as MovieStatus | null,
      
      // Nested Objects
      stats: {
        ratingoScore: movie.ratingoScore,
        qualityScore: movie.qualityScore,
        popularityScore: movie.popularityScore,
        liveWatchers: movie.watchersCount,
        totalWatchers: movie.totalWatchers,
      },
      externalRatings: {
        tmdb: { rating: movie.rating, voteCount: movie.voteCount },
        imdb: movie.ratingImdb ? { rating: movie.ratingImdb, voteCount: movie.voteCountImdb } : null,
        trakt: movie.ratingTrakt ? { rating: movie.ratingTrakt, voteCount: movie.voteCountTrakt } : null,
        metacritic: movie.ratingMetacritic ? { rating: movie.ratingMetacritic } : null,
        rottenTomatoes: movie.ratingRottenTomatoes ? { rating: movie.ratingRottenTomatoes } : null,
      },
      
      genres,
    };
  }

  // Common select fields for movie queries
  private readonly movieSelectFields = {
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
    
    // External Ratings
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
   * Finds movies currently in theaters (isNowPlaying = true).
   * Data is synced from TMDB /movie/now_playing endpoint.
   */
  async findNowPlaying(options: NowPlayingOptions = {}): Promise<MovieWithMedia[]> {
    const { limit = 20, offset = 0 } = options;

    const results = await this.db
      .select(this.movieSelectFields)
      .from(schema.movies)
      .innerJoin(schema.mediaItems, eq(schema.movies.mediaItemId, schema.mediaItems.id))
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(eq(schema.movies.isNowPlaying, true))
      .orderBy(desc(schema.mediaItems.popularity))
      .limit(limit)
      .offset(offset);

    return this.attachGenres(results);
  }

  /**
   * Finds movies recently released in theaters.
   * Uses theatricalReleaseDate within the specified period.
   */
  async findNewReleases(options: NowPlayingOptions = {}): Promise<MovieWithMedia[]> {
    const { limit = 20, offset = 0, daysBack = 30 } = options;

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    const results = await this.db
      .select(this.movieSelectFields)
      .from(schema.movies)
      .innerJoin(schema.mediaItems, eq(schema.movies.mediaItemId, schema.mediaItems.id))
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(
        and(
          isNotNull(schema.movies.theatricalReleaseDate),
          gte(schema.movies.theatricalReleaseDate, cutoffDate),
          lte(schema.movies.theatricalReleaseDate, now)
        )
      )
      .orderBy(desc(schema.mediaItems.popularity))
      .limit(limit)
      .offset(offset);

    return this.attachGenres(results);
  }

  /**
   * Finds movies recently released on digital platforms.
   * Uses indexed digitalReleaseDate for fast queries.
   */
  async findNewOnDigital(options: NowPlayingOptions = {}): Promise<MovieWithMedia[]> {
    const { limit = 20, offset = 0, daysBack = 14 } = options;

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    const results = await this.db
      .select(this.movieSelectFields)
      .from(schema.movies)
      .innerJoin(schema.mediaItems, eq(schema.movies.mediaItemId, schema.mediaItems.id))
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(
        and(
          isNotNull(schema.movies.digitalReleaseDate),
          gte(schema.movies.digitalReleaseDate, cutoffDate),
          lte(schema.movies.digitalReleaseDate, now)
        )
      )
      .orderBy(desc(schema.mediaItems.popularity))
      .limit(limit)
      .offset(offset);

    return this.attachGenres(results);
  }

  /**
   * Sets isNowPlaying flag for movies.
   * Two-step approach using ORM for clarity and type-safety.
   */
  async setNowPlaying(tmdbIds: number[]): Promise<void> {
    if (tmdbIds.length === 0) {
      this.logger.warn('setNowPlaying called with empty array');
      return;
    }

    await this.db.transaction(async (tx) => {
      // Step 1: Reset all currently playing movies to false
      await tx
        .update(schema.movies)
        .set({ isNowPlaying: false })
        .where(eq(schema.movies.isNowPlaying, true));

      // Step 2: Get media item IDs for the new now-playing movies
      const mediaItems = await tx
        .select({ id: schema.mediaItems.id })
        .from(schema.mediaItems)
        .where(inArray(schema.mediaItems.tmdbId, tmdbIds));

      if (mediaItems.length === 0) {
        this.logger.warn('No media items found for now playing TMDB IDs');
        return;
      }

      const mediaItemIds = mediaItems.map(m => m.id);

      // Step 3: Set isNowPlaying = true for matching movies
      await tx
        .update(schema.movies)
        .set({ isNowPlaying: true })
        .where(inArray(schema.movies.mediaItemId, mediaItemIds));

      this.logger.log(`Set ${mediaItemIds.length} movies as now playing`);
    });
  }

  /**
   * Updates release dates for a movie.
   */
  async updateReleaseDates(
    mediaItemId: string,
    data: {
      theatricalReleaseDate?: Date | null;
      digitalReleaseDate?: Date | null;
      releases?: ReleaseInfo[];
    }
  ): Promise<void> {
    await this.db
      .update(schema.movies)
      .set({
        theatricalReleaseDate: data.theatricalReleaseDate,
        digitalReleaseDate: data.digitalReleaseDate,
        releases: data.releases,
      })
      .where(eq(schema.movies.mediaItemId, mediaItemId));
  }

  /**
   * Helper to attach genres to a list of movies
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
      genresMap.get(g.mediaItemId).push({ id: g.id, name: g.name, slug: g.slug });
    });

    return movies.map(m => ({
      // Basic
      id: m.id,
      mediaItemId: m.mediaItemId,
      tmdbId: m.tmdbId,
      title: m.title,
      slug: m.slug,
      overview: m.overview,
      posterPath: m.posterPath,
      backdropPath: m.backdropPath,
      popularity: m.popularity,
      releaseDate: m.releaseDate,
      theatricalReleaseDate: m.theatricalReleaseDate,
      digitalReleaseDate: m.digitalReleaseDate,
      runtime: m.runtime,

      // Nested Stats & Ratings
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
