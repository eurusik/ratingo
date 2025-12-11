import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, inArray } from 'drizzle-orm';
import {
  IMovieRepository,
  MovieWithMedia,
  NowPlayingOptions,
} from '../../domain/repositories/movie.repository.interface';
import { ReleaseInfo } from '../../../../database/schema';
import { PersistenceMapper } from '../mappers/persistence.mapper';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { TrendingShowsQueryDto } from '../../presentation/dtos/trending.dto';

// Query Objects
import { MovieDetailsQuery } from '../queries/movie-details.query';
import { TrendingMoviesQuery } from '../queries/trending-movies.query';
import { MovieListingsQuery } from '../queries/movie-listings.query';

type DbTransaction = Parameters<Parameters<PostgresJsDatabase<typeof schema>['transaction']>[0]>[0];

/**
 * Drizzle implementation of IMovieRepository.
 * Acts as a thin facade, delegating complex queries to Query Objects.
 */
@Injectable()
export class DrizzleMovieRepository implements IMovieRepository {
  private readonly logger = new Logger(DrizzleMovieRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly movieDetailsQuery: MovieDetailsQuery,
    private readonly trendingMoviesQuery: TrendingMoviesQuery,
    private readonly movieListingsQuery: MovieListingsQuery
  ) {}

  /**
   * Upserts movie details transactionally.
   */
  async upsertDetails(tx: DbTransaction, mediaId: string, details: any): Promise<void> {
    await tx
      .insert(schema.movies)
      .values(PersistenceMapper.toMovieInsert(mediaId, details))
      .onConflictDoUpdate({
        target: schema.movies.mediaItemId,
        set: PersistenceMapper.toMovieUpdate(details),
      });
  }

  /**
   * Sets isNowPlaying flag for movies.
   */
  async setNowPlaying(tmdbIds: number[]): Promise<void> {
    if (tmdbIds.length === 0) {
      this.logger.warn('setNowPlaying called with empty array');
      return;
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.movies)
        .set({ isNowPlaying: false })
        .where(eq(schema.movies.isNowPlaying, true));

      const mediaItems = await tx
        .select({ id: schema.mediaItems.id })
        .from(schema.mediaItems)
        .where(inArray(schema.mediaItems.tmdbId, tmdbIds));

      if (mediaItems.length === 0) {
        this.logger.warn('No media items found for now playing TMDB IDs');
        return;
      }

      const mediaItemIds = mediaItems.map((m) => m.id);

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
    try {
      await this.db
        .update(schema.movies)
        .set({
          theatricalReleaseDate: data.theatricalReleaseDate,
          digitalReleaseDate: data.digitalReleaseDate,
          releases: data.releases,
        })
        .where(eq(schema.movies.mediaItemId, mediaItemId));
    } catch (error) {
      this.logger.error(`Failed to update release dates: ${error.message}`, error.stack);
      throw new DatabaseException('Failed to update release dates', {
        originalError: error.message,
      });
    }
  }

  /**
   * Finds full movie details by slug.
   */
  async findBySlug(slug: string): Promise<any> {
    return this.movieDetailsQuery.execute(slug);
  }

  /**
   * Finds trending movies sorted by popularity and rating.
   */
  async findTrending(options: TrendingShowsQueryDto): Promise<any[]> {
    return this.trendingMoviesQuery.execute(options);
  }

  /**
   * Finds movies currently in theaters (isNowPlaying = true).
   */
  async findNowPlaying(options: NowPlayingOptions = {}): Promise<MovieWithMedia[]> {
    return this.movieListingsQuery.execute('now_playing', options);
  }

  /**
   * Finds movies recently released in theaters.
   */
  async findNewReleases(options: NowPlayingOptions = {}): Promise<MovieWithMedia[]> {
    return this.movieListingsQuery.execute('new_releases', options);
  }

  /**
   * Finds movies recently released on digital platforms.
   */
  async findNewOnDigital(options: NowPlayingOptions = {}): Promise<MovieWithMedia[]> {
    return this.movieListingsQuery.execute('new_on_digital', options);
  }
}
