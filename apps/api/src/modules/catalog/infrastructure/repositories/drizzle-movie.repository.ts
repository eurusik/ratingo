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
    theatricalReleaseDate: schema.movies.theatricalReleaseDate,
    digitalReleaseDate: schema.movies.digitalReleaseDate,
    runtime: schema.movies.runtime,
    ratingoScore: schema.mediaStats.ratingoScore,
    qualityScore: schema.mediaStats.qualityScore,
    popularityScore: schema.mediaStats.popularityScore,
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

    return results as MovieWithMedia[];
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

    return results as MovieWithMedia[];
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

    return results as MovieWithMedia[];
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
}
