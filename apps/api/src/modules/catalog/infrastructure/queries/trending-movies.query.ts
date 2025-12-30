import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, gte, lte, isNotNull, inArray, and, exists, sql, isNull } from 'drizzle-orm';
import { ImageMapper } from '../mappers/image.mapper';
import { DatabaseException } from '../../../../common/exceptions/database.exception';
import type {
  TrendingMovieItem,
  WithTotal,
} from '../../domain/repositories/movie.repository.interface';
import {
  CatalogSort,
  SortOrder,
  VoteSource,
  CATALOG_SORT,
  SORT_ORDER,
  VOTE_SOURCE,
} from '../../presentation/dtos/catalog-list-query.dto';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { EligibilityStatus } from '../../../catalog-policy/domain/constants/evaluation.constants';
import {
  CLASSIC_THRESHOLDS,
  NEW_RELEASE_THRESHOLDS,
  TRENDING_THRESHOLDS,
  MOVIE_TRENDING_WEIGHTS,
} from '../../domain/constants/catalog.constants';
import { GenreQuery } from './shared/genre.query';

/**
 * Options for trending movies query.
 */
export interface TrendingMoviesOptions {
  limit?: number;
  offset?: number;
  minRatingo?: number;
  genres?: string[];
  sort?: CatalogSort;
  order?: SortOrder;
  voteSource?: VoteSource;
  minVotes?: number;
  year?: number;
  yearFrom?: number;
  yearTo?: number;
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
  private readonly genreQuery: GenreQuery;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {
    this.genreQuery = new GenreQuery(db);
  }

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
   * Only returns ELIGIBLE items (filtered via media_catalog_evaluations).
   *
   * @param {TrendingMoviesOptions} options - Query options (limit, offset, filters)
   * @returns {Promise<any[]>} List of trending movies with stats and genres
   * @throws {DatabaseException} When database query fails
   */
  async execute(options: TrendingMoviesOptions): Promise<WithTotal<TrendingMovieItem>> {
    const {
      limit = 20,
      offset = 0,
      minRatingo,
      genres,
      sort = CATALOG_SORT.POPULARITY,
      order = SORT_ORDER.DESC,
      voteSource = VOTE_SOURCE.TMDB,
      minVotes,
      year,
      yearFrom,
      yearTo,
    } = options;

    try {
      const conditions: any[] = [
        isNotNull(schema.mediaStats.popularityScore),
        // Eligibility filter: only show ELIGIBLE items
        eq(schema.mediaCatalogEvaluations.status, EligibilityStatus.ELIGIBLE),
        // Ready filter: only show items with ready ingestion status
        eq(schema.mediaItems.ingestionStatus, IngestionStatus.READY),
        // Not deleted filter
        isNull(schema.mediaItems.deletedAt),
      ];

      // Trending hard gate: only new content OR actively watched
      // This prevents old movies with low engagement from appearing in trending
      if (sort === CATALOG_SORT.TRENDING) {
        conditions.push(
          sql`(
            COALESCE(${schema.mediaStats.freshnessScore}, 0) >= ${TRENDING_THRESHOLDS.MIN_FRESHNESS}
            OR COALESCE(${schema.mediaStats.watchersCount}, 0) >= ${TRENDING_THRESHOLDS.MIN_WATCHERS}
          )`,
        );
      }

      if (minRatingo !== undefined) {
        conditions.push(gte(schema.mediaStats.ratingoScore, minRatingo));
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

      if (minVotes !== undefined) {
        if (voteSource === 'trakt') {
          conditions.push(gte(schema.mediaItems.voteCountTrakt, minVotes));
        } else {
          conditions.push(gte(schema.mediaItems.voteCount, minVotes));
        }
      }

      if (year !== undefined) {
        const { start, end } = this.buildYearRange(year);
        conditions.push(
          isNotNull(schema.mediaItems.releaseDate),
          gte(schema.mediaItems.releaseDate, start),
          lte(schema.mediaItems.releaseDate, end),
        );
      } else if (yearFrom !== undefined || yearTo !== undefined) {
        if (yearFrom !== undefined) {
          const start = this.buildYearStart(yearFrom);
          conditions.push(
            isNotNull(schema.mediaItems.releaseDate),
            gte(schema.mediaItems.releaseDate, start),
          );
        }
        if (yearTo !== undefined) {
          const end = this.buildYearStart(yearTo + 1);
          conditions.push(
            isNotNull(schema.mediaItems.releaseDate),
            lte(schema.mediaItems.releaseDate, end),
          );
        }
      }

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
        .orderBy(...this.buildOrder(sort, order))
        .limit(limit)
        .offset(offset);

      const total = await this.countTotal(conditions);
      const moviesWithGenres = await this.attachGenres(results);
      const mapped = this.mapResults(moviesWithGenres);
      const withTotal = mapped as WithTotal<TrendingMovieItem>;
      withTotal.total = total;
      return withTotal;
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
  private mapResults(movies: any[]): TrendingMovieItem[] {
    const now = new Date();
    const newReleaseCutoff = new Date(now);
    newReleaseCutoff.setDate(now.getDate() - NEW_RELEASE_THRESHOLDS.DAYS);

    const classicCutoff = new Date(now);
    classicCutoff.setFullYear(now.getFullYear() - CLASSIC_THRESHOLDS.YEARS_OLD);

    return movies.map((m) => ({
      ...m,
      isNew: m.releaseDate ? m.releaseDate >= newReleaseCutoff : false,
      isClassic: m.releaseDate
        ? m.releaseDate <= classicCutoff ||
          ((m.stats.ratingoScore || 0) >= CLASSIC_THRESHOLDS.RATINGO_SCORE &&
            (m.stats.totalWatchers || 0) > CLASSIC_THRESHOLDS.TOTAL_WATCHERS)
        : false,
    })) as TrendingMovieItem[];
  }

  private buildYearStart(year: number): Date {
    return new Date(Date.UTC(year, 0, 1));
  }

  private buildYearRange(year: number): { start: Date; end: Date } {
    const start = this.buildYearStart(year);
    const end = this.buildYearStart(year + 1);
    return { start, end };
  }

  private buildOrder(sort: CatalogSort, order: SortOrder) {
    const dir = order === 'asc' ? sql`asc` : sql`desc`;
    const nullsLast = sql`NULLS LAST`;

    if (sort === 'trending') {
      // Movie-specific trending formula (different from shows)
      // Movies are consumed differently: one-time viewing, short spikes
      const w = MOVIE_TRENDING_WEIGHTS;
      return [
        sql`(
          COALESCE(${schema.mediaStats.ratingoScore}, 0) * ${w.RATINGO} +
          COALESCE(${schema.mediaStats.popularityScore}, 0) * ${w.POPULARITY} +
          (COALESCE(${schema.mediaStats.watchersCount}, 0)::float / (COALESCE(${schema.mediaStats.watchersCount}, 0) + ${w.WATCHERS_SATURATION_K})) * 100 * ${w.WATCHERS} +
          COALESCE(${schema.mediaItems.trendingScore}, 0) / 100.0 * ${w.TMDB}
        ) ${dir} ${nullsLast}`,
        sql`${schema.mediaItems.id} desc`,
      ];
    }
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
  private async attachGenres(movies: any[]): Promise<any[]> {
    if (movies.length === 0) return [];

    const mediaItemIds = movies.map((m) => m.mediaItemId);
    const genresMap = await this.genreQuery.fetchForMediaItems(mediaItemIds);

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
