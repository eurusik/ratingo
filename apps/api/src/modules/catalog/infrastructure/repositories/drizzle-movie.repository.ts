import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, inArray } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { withDbError } from '../../../../common/utils/db-error.utils';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  type IMovieRepository,
  type MovieWithMedia,
  type MovieDetails,
  type MovieListQueryOptions,
  type TrendingMovieItem,
  type TrendingQueryResult,
  type WithTotal,
  type ReleaseInfo,
} from '../../domain/repositories/movie.repository.interface';
import { type DatabaseTransaction } from '../../domain/types/transaction.type';
import { MoviePersistenceMapper } from '../mappers/movie-persistence.mapper';
import { MovieDetailsQuery } from '../queries/movie-details.query';
import {
  MovieListingsQuery,
  MOVIE_LISTING_TYPE,
  ELIGIBILITY_MODE,
} from '../queries/movie-listings.query';
import { PopularMoviesQuery } from '../queries/popular-movies.query';
import { TrendingMoviesQuery } from '../queries/trending-movies.query';
import { toDrizzleTx } from '../utils/drizzle-transaction';

/**
 * Movie details payload for upsert operation.
 */
interface MovieDetailsPayload {
  runtime?: number | null;
  budget?: number | null;
  revenue?: number | null;
  status?: string | null;
  theatricalReleaseDate?: Date | null;
  digitalReleaseDate?: Date | null;
  releases?: ReleaseInfo[];
}

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
    private readonly popularMoviesQuery: PopularMoviesQuery,
    private readonly movieListingsQuery: MovieListingsQuery,
  ) {}

  /**
   * Upserts movie details transactionally.
   *
   * Note: Does not use withDbError() intentionally - errors should propagate
   * to parent transaction scope for proper rollback handling. The caller
   * (typically DrizzleMediaRepository.upsert) is responsible for error handling.
   */
  async upsertDetails(
    tx: DatabaseTransaction,
    mediaId: string,
    details: MovieDetailsPayload,
  ): Promise<void> {
    const drizzleTx = toDrizzleTx(tx);
    await drizzleTx
      .insert(schema.movies)
      .values(MoviePersistenceMapper.toMovieInsert(mediaId, details))
      .onConflictDoUpdate({
        target: schema.movies.mediaItemId,
        set: MoviePersistenceMapper.toMovieUpdate(details),
      });
  }

  /** Sets isNowPlaying flag for movies. */
  async setNowPlaying(tmdbIds: number[]): Promise<void> {
    if (tmdbIds.length === 0) {
      this.logger.warn('setNowPlaying called with empty array');
      return;
    }

    return withDbError(
      'set now playing movies',
      this.logger,
      async () => {
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
      },
      { count: tmdbIds.length },
    );
  }

  /** Updates release dates for a movie. */
  async updateReleaseDates(
    mediaItemId: string,
    data: {
      theatricalReleaseDate?: Date | null;
      digitalReleaseDate?: Date | null;
      releases?: ReleaseInfo[];
    },
  ): Promise<void> {
    return withDbError(
      'update release dates',
      this.logger,
      async () => {
        await this.db
          .update(schema.movies)
          .set({
            theatricalReleaseDate: data.theatricalReleaseDate,
            digitalReleaseDate: data.digitalReleaseDate,
            releases: data.releases,
          })
          .where(eq(schema.movies.mediaItemId, mediaItemId));
      },
      { mediaItemId },
    );
  }

  /** Finds full movie details by slug. */
  async findBySlug(slug: string): Promise<MovieDetails | null> {
    return this.movieDetailsQuery.execute(slug);
  }

  /** Finds trending movies sorted by popularity and rating. */
  async findTrending(
    options: MovieListQueryOptions = {},
  ): Promise<TrendingQueryResult<TrendingMovieItem>> {
    const normalized = { ...options, genres: this.normalizeGenres(options.genres) };
    return this.trendingMoviesQuery.execute(normalized);
  }

  /** Finds popular movies (historically popular, no freshness gate). */
  async findPopular(
    options: MovieListQueryOptions = {},
  ): Promise<TrendingQueryResult<TrendingMovieItem>> {
    const normalized = { ...options, genres: this.normalizeGenres(options.genres) };
    return this.popularMoviesQuery.execute(normalized);
  }

  /** Finds movies currently in theaters. No eligibility filtering - show all. */
  async findNowPlaying(options: MovieListQueryOptions = {}): Promise<WithTotal<MovieWithMedia>> {
    return this.movieListingsQuery.execute(MOVIE_LISTING_TYPE.NOW_PLAYING, {
      ...options,
      eligibilityMode: ELIGIBILITY_MODE.NONE,
    });
  }

  /** Finds movies recently released in theaters. Uses catalog eligibility mode. */
  async findNewReleases(options: MovieListQueryOptions = {}): Promise<WithTotal<MovieWithMedia>> {
    return this.movieListingsQuery.execute(MOVIE_LISTING_TYPE.NEW_RELEASES, options);
  }

  /** Finds movies recently released on digital platforms. Uses catalog eligibility mode. */
  async findNewOnDigital(options: MovieListQueryOptions = {}): Promise<WithTotal<MovieWithMedia>> {
    return this.movieListingsQuery.execute(MOVIE_LISTING_TYPE.NEW_ON_DIGITAL, options);
  }

  private normalizeGenres(genres?: string | string[]): string[] | undefined {
    if (!genres) return undefined;
    const arr = Array.isArray(genres) ? genres : genres.split(',');
    const cleaned = arr.map((g) => g.trim()).filter((g) => g.length > 0);
    return cleaned.length ? cleaned : undefined;
  }
}
