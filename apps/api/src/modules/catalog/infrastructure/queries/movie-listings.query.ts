import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import {
  eq,
  gte,
  gt,
  lte,
  desc,
  isNotNull,
  isNull,
  inArray,
  and,
  or,
  exists,
  sql,
} from 'drizzle-orm';
import { MovieWithMedia, WithTotal } from '../../domain/repositories/movie.repository.interface';
import { ImageMapper } from '../mappers/image.mapper';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import { CatalogSort, SortOrder, VoteSource } from '../../presentation/dtos/catalog-list-query.dto';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { EligibilityStatus } from '../../../catalog-policy/domain/constants/evaluation.constants';

/**
 * Type of movie listing to fetch.
 */
export const MOVIE_LISTING_TYPE = {
  NOW_PLAYING: 'now_playing',
  NEW_RELEASES: 'new_releases',
  NEW_ON_DIGITAL: 'new_on_digital',
} as const;
export type MovieListingType = (typeof MOVIE_LISTING_TYPE)[keyof typeof MOVIE_LISTING_TYPE];

/**
 * Options for movie listings query.
 */
export interface MovieListingOptions {
  limit?: number;
  offset?: number;
  daysBack?: number;
  sort?: CatalogSort;
  order?: SortOrder;
  genres?: string[];
  minRatingo?: number;
  voteSource?: VoteSource;
  minVotes?: number;
  year?: number;
  yearFrom?: number;
  yearTo?: number;
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
   * Executes the movie listings query.
   * Only returns ELIGIBLE items (filtered via media_catalog_evaluations).
   *
   * @param {MovieListingType} type - Type of listing (now_playing, new_releases, new_on_digital)
   * @param {MovieListingOptions} options - Query options (limit, offset, daysBack)
   * @returns {Promise<MovieWithMedia[]>} List of movies matching the criteria
   * @throws {DatabaseException} When database query fails
   */
  async execute(
    type: MovieListingType,
    options: MovieListingOptions = {},
  ): Promise<WithTotal<MovieWithMedia>> {
    const {
      limit = 20,
      offset = 0,
      daysBack,
      sort = 'popularity',
      order = 'desc',
      genres,
      minRatingo,
      voteSource = 'tmdb',
      minVotes,
      year,
      yearFrom,
      yearTo,
    } = options;

    try {
      const { conditions, orderBy } = this.buildQueryParams(
        type,
        daysBack,
        sort,
        order,
        genres,
        minRatingo,
        voteSource,
        minVotes,
        year,
        yearFrom,
        yearTo,
      );

      const results = await this.db
        .select(this.selectFields)
        .from(schema.movies)
        .innerJoin(schema.mediaItems, eq(schema.movies.mediaItemId, schema.mediaItems.id))
        .innerJoin(schema.catalogPolicies, eq(schema.catalogPolicies.isActive, true))
        .innerJoin(
          schema.mediaCatalogEvaluations,
          and(
            eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
            eq(schema.mediaCatalogEvaluations.policyVersion, schema.catalogPolicies.version),
          ),
        )
        .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
        .where(and(...conditions))
        .orderBy(...orderBy)
        .limit(limit)
        .offset(offset);

      const total = await this.countTotal(conditions);

      const items = await this.attachGenres(results);
      const withTotal = items as WithTotal<MovieWithMedia>;
      withTotal.total = total;
      return withTotal;
    } catch (error) {
      this.logger.error(`Failed to find ${type} movies: ${error.message}`, error.stack);
      throw new DatabaseException(`Failed to fetch ${type} movies`, {
        originalError: error.message,
      });
    }
  }

  /**
   * Builds query conditions and order based on listing type.
   */
  private buildQueryParams(
    type: MovieListingType,
    daysBack: number | undefined,
    sort: CatalogSort,
    order: SortOrder,
    genres?: string[],
    minRatingo?: number,
    voteSource?: VoteSource,
    minVotes?: number,
    year?: number,
    yearFrom?: number,
    yearTo?: number,
  ) {
    const now = new Date();
    const conditions: any[] = [
      // Eligibility filter: only show ELIGIBLE items
      eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
      // Ready filter: only show items with ready ingestion status
      eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
      // Not deleted filter
      isNull(schema.mediaItems.deletedAt),
    ];

    // Release date filters
    if (year !== undefined) {
      const start = new Date(Date.UTC(year, 0, 1));
      const end = new Date(Date.UTC(year + 1, 0, 1));
      conditions.push(
        isNotNull(schema.mediaItems.releaseDate),
        gte(schema.mediaItems.releaseDate, start),
        lte(schema.mediaItems.releaseDate, end),
      );
    } else if (yearFrom !== undefined || yearTo !== undefined) {
      if (yearFrom !== undefined) {
        const start = new Date(Date.UTC(yearFrom, 0, 1));
        conditions.push(
          isNotNull(schema.mediaItems.releaseDate),
          gte(schema.mediaItems.releaseDate, start),
        );
      }
      if (yearTo !== undefined) {
        const end = new Date(Date.UTC(yearTo + 1, 0, 1));
        conditions.push(
          isNotNull(schema.mediaItems.releaseDate),
          lte(schema.mediaItems.releaseDate, end),
        );
      }
    }

    if (minRatingo !== undefined) {
      conditions.push(gte(schema.mediaStats.ratingoScore, minRatingo));
    }

    if (minVotes !== undefined) {
      if (voteSource === 'trakt') {
        conditions.push(gte(schema.mediaItems.voteCountTrakt, minVotes));
      } else {
        conditions.push(gte(schema.mediaItems.voteCount, minVotes));
      }
    }

    if (genres && genres.length) {
      conditions.push(
        exists(
          this.db
            .select({ id: schema.mediaGenres.id })
            .from(schema.mediaGenres)
            .innerJoin(schema.genres, eq(schema.mediaGenres.genreId, schema.genres.id))
            .where(
              and(
                eq(schema.mediaGenres.mediaItemId, schema.mediaItems.id),
                inArray(schema.genres.slug, genres),
              ),
            ),
        ),
      );
    }

    switch (type) {
      case 'now_playing':
        conditions.push(
          eq(schema.movies.isNowPlaying, true),
          // Exclude movies already on streaming
          or(isNull(schema.movies.digitalReleaseDate), gt(schema.movies.digitalReleaseDate, now)),
        );
        return {
          conditions,
          orderBy: this.buildOrder(sort, order),
        };

      case 'new_releases': {
        const cutoffDate = new Date();
        cutoffDate.setDate(now.getDate() - (daysBack ?? 30));
        conditions.push(
          isNotNull(schema.movies.theatricalReleaseDate),
          gte(schema.movies.theatricalReleaseDate, cutoffDate),
          lte(schema.movies.theatricalReleaseDate, now),
          // Exclude movies already on streaming
          or(isNull(schema.movies.digitalReleaseDate), gt(schema.movies.digitalReleaseDate, now)),
        );
        return {
          conditions,
          orderBy: this.buildOrder(sort, order),
        };
      }

      case 'new_on_digital': {
        const cutoffDate = new Date(now.getTime() - (daysBack ?? 14) * 24 * 60 * 60 * 1000);
        conditions.push(
          isNotNull(schema.movies.digitalReleaseDate),
          gte(schema.movies.digitalReleaseDate, cutoffDate),
          lte(schema.movies.digitalReleaseDate, now),
        );
        return {
          conditions,
          orderBy: this.buildOrder(sort, order),
        };
      }
    }
  }

  private buildOrder(sort: CatalogSort, order: SortOrder) {
    const dir = order === 'asc' ? sql`asc` : sql`desc`;
    const nullsLast = sql`NULLS LAST`;

    if (sort === 'ratingo') {
      return [sql`${schema.mediaStats.ratingoScore} ${dir}`, sql`${schema.mediaItems.id} desc`];
    }
    if (sort === 'releaseDate') {
      return [
        sql`${schema.mediaItems.releaseDate} ${dir} ${nullsLast}`,
        sql`${schema.mediaItems.id} desc`,
      ];
    }
    if (sort === 'tmdbPopularity') {
      return [sql`${schema.mediaItems.popularity} ${dir}`, sql`${schema.mediaItems.id} desc`];
    }
    // default popularity (aggregated)
    return [sql`${schema.mediaStats.popularityScore} ${dir}`, sql`${schema.mediaItems.id} desc`];
  }

  private async countTotal(conditions: any[]): Promise<number> {
    const [{ total }] = await this.db
      .select({ total: sql<number>`count(*)` })
      .from(schema.movies)
      .innerJoin(schema.mediaItems, eq(schema.movies.mediaItemId, schema.mediaItems.id))
      .innerJoin(schema.catalogPolicies, eq(schema.catalogPolicies.isActive, true))
      .innerJoin(
        schema.mediaCatalogEvaluations,
        and(
          eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
          eq(schema.mediaCatalogEvaluations.policyVersion, schema.catalogPolicies.version),
        ),
      )
      .leftJoin(schema.mediaStats, eq(schema.mediaItems.id, schema.mediaStats.mediaItemId))
      .where(and(...conditions));
    return Number(total ?? 0);
  }

  /**
   * Attaches genres to movies in a single batch query.
   */
  private async attachGenres(movies: any[]): Promise<MovieWithMedia[]> {
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
    })) as MovieWithMedia[];
  }
}
