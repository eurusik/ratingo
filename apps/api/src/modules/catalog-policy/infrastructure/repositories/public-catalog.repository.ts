/**
 * Public Catalog Repository
 *
 * Read-only repository that queries ONLY from public_media_items view.
 * This ensures all public endpoints return only ELIGIBLE content.
 *
 * Key invariant: This repository CANNOT bypass eligibility filtering.
 * All methods query from the view which has WHERE status = 'eligible'.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DEFAULT_PAGE_SIZE, DEFAULT_BATCH_SIZE } from '../../../../common/constants';
import { DatabaseException } from '../../../../common/exceptions';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import type * as schema from '../../../../database/schema';
import type { Credits, WatchProvidersMap } from '../../../ingestion/public';
import { TRENDING_GATE } from '../../catalog-policy.constants';

export const PUBLIC_CATALOG_REPOSITORY = 'PUBLIC_CATALOG_REPOSITORY';

/**
 * Raw row shape from public_media_items view (snake_case).
 */
interface RawPublicMediaItemRow {
  id: string;
  type: 'movie' | 'show';
  tmdb_id: number;
  imdb_id: string | null;
  title: string;
  original_title: string | null;
  slug: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  videos: schema.Video[] | null;
  credits: Credits | null;
  watch_providers_raw: WatchProvidersMap | null;
  trending_score: number | null;
  trending_rank: number | null;
  popularity: number | null;
  rating: number | null;
  vote_count: number | null;
  rating_imdb: number | null;
  rating_metacritic: number | null;
  rating_rotten_tomatoes: number | null;
  rating_trakt: number | null;
  release_date: string | null;
  origin_countries: string[] | null;
  original_language: string | null;
  created_at: string;
  updated_at: string;
  ratingo_score: number | null;
  quality_score: number | null;
  popularity_score: number | null;
  freshness_score: number | null;
  watchers_count: number | null;
  relevance_score: number | null;
  eligibility_status: string | null;
}

/**
 * DTO for rows returned from public_media_items view.
 * Single source of truth for public catalog data shape.
 * Note: watchProviders is kept for API compatibility, reads from watch_providers_raw
 */
export interface PublicMediaItemRow {
  id: string;
  type: 'movie' | 'show';
  tmdbId: number;
  imdbId: string | null;
  title: string;
  originalTitle: string | null;
  slug: string;
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  videos: schema.Video[] | null;
  credits: Credits | null;
  /** @deprecated Use media_watch_offers for normalized data. Kept for API compatibility. */
  watchProviders: WatchProvidersMap | null;
  trendingScore: number | null;
  trendingRank: number | null;
  popularity: number | null;
  rating: number | null;
  voteCount: number | null;
  ratingImdb: number | null;
  ratingMetacritic: number | null;
  ratingRottenTomatoes: number | null;
  ratingTrakt: number | null;
  releaseDate: Date | null;
  originCountries: string[] | null;
  originalLanguage: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Stats
  ratingoScore: number | null;
  qualityScore: number | null;
  popularityScore: number | null;
  freshnessScore: number | null;
  watchersCount: number | null;
  // Evaluation
  relevanceScore: number;
  eligibilityStatus: string;
}

export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

export interface TrendingOptions extends PaginationOptions {
  type?: 'movie' | 'show';
}

export interface SearchOptions extends PaginationOptions {
  type?: 'movie' | 'show';
}

export interface HomepageOptions {
  minRelevanceScore?: number;
  limit?: number;
}

export interface IPublicCatalogRepository {
  /**
   * Finds trending media items ordered by trending score.
   * Only returns ELIGIBLE items from public_media_items view.
   */
  findTrending(options?: TrendingOptions): Promise<PublicMediaItemRow[]>;

  /**
   * Searches media items by title/overview.
   * Only returns ELIGIBLE items from public_media_items view.
   */
  search(query: string, options?: SearchOptions): Promise<PublicMediaItemRow[]>;

  /**
   * Finds media items for homepage with minimum relevance score.
   * Only returns ELIGIBLE items from public_media_items view.
   */
  findForHomepage(options?: HomepageOptions): Promise<PublicMediaItemRow[]>;

  /**
   * Finds a single media item by ID.
   * Returns null if item is not ELIGIBLE (not in public view).
   */
  findById(id: string): Promise<PublicMediaItemRow | null>;

  /**
   * Finds a single media item by slug.
   * Returns null if item is not ELIGIBLE (not in public view).
   */
  findBySlug(slug: string): Promise<PublicMediaItemRow | null>;

  /**
   * Counts total eligible items (optionally by type).
   */
  countEligible(type?: 'movie' | 'show'): Promise<number>;
}

@Injectable()
export class PublicCatalogRepository implements IPublicCatalogRepository {
  private readonly logger = new Logger(PublicCatalogRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async findTrending(options?: TrendingOptions): Promise<PublicMediaItemRow[]> {
    const limit = options?.limit ?? DEFAULT_PAGE_SIZE;
    const offset = options?.offset ?? 0;

    try {
      let query = sql`
        SELECT * FROM public_media_items
        WHERE (
          COALESCE(freshness_score, 0) >= ${TRENDING_GATE.MIN_FRESHNESS_SCORE}
          OR COALESCE(watchers_count, 0) >= ${TRENDING_GATE.MIN_WATCHERS_COUNT}
        )
      `;

      if (options?.type) {
        query = sql`${query} AND type = ${options.type}`;
      }

      // Combined trending score with live engagement signal
      // - ratingo (50%): quality baseline
      // - popularity (20%): long-term engagement
      // - watchers (25%): live signal with soft saturation w/(w+100)
      // - TMDB (5%): external trending signal (noise only)
      query = sql`${query} 
        ORDER BY (
          COALESCE(ratingo_score, 0) * 0.50 +
          COALESCE(popularity_score, 0) * 0.20 +
          (COALESCE(watchers_count, 0)::float / (COALESCE(watchers_count, 0) + 100)) * 100 * 0.25 +
          COALESCE(trending_score, 0) / 100.0 * 0.05
        ) DESC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `;

      const result = await this.db.execute(query);
      return (result as unknown as RawPublicMediaItemRow[]).map((row) => this.mapToDto(row));
    } catch (error) {
      this.logger.error('Failed to find trending items', error);
      throw new DatabaseException('Failed to find trending items', error);
    }
  }

  async search(query: string, options?: SearchOptions): Promise<PublicMediaItemRow[]> {
    const limit = options?.limit ?? DEFAULT_PAGE_SIZE;
    const offset = options?.offset ?? 0;
    const searchTerm = query.trim();

    if (!searchTerm) {
      return [];
    }

    try {
      let sqlQuery = sql`
        SELECT *, 
          ts_rank(search_vector, plainto_tsquery('simple', ${searchTerm})) AS rank
        FROM public_media_items
        WHERE search_vector @@ plainto_tsquery('simple', ${searchTerm})
      `;

      if (options?.type) {
        sqlQuery = sql`${sqlQuery} AND type = ${options.type}`;
      }

      sqlQuery = sql`${sqlQuery}
        ORDER BY rank DESC, trending_score DESC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `;

      const result = await this.db.execute(sqlQuery);
      return (result as unknown as RawPublicMediaItemRow[]).map((row) => this.mapToDto(row));
    } catch (error) {
      this.logger.error(`Failed to search for "${query}"`, error);
      throw new DatabaseException('Failed to search catalog', error);
    }
  }

  async findForHomepage(options?: HomepageOptions): Promise<PublicMediaItemRow[]> {
    const minRelevanceScore = options?.minRelevanceScore ?? DEFAULT_BATCH_SIZE;
    const limit = options?.limit ?? DEFAULT_PAGE_SIZE;

    try {
      const query = sql`
        SELECT * FROM public_media_items
        WHERE relevance_score >= ${minRelevanceScore}
        ORDER BY relevance_score DESC, trending_score DESC NULLS LAST
        LIMIT ${limit}
      `;

      const result = await this.db.execute(query);
      return (result as unknown as RawPublicMediaItemRow[]).map((row) => this.mapToDto(row));
    } catch (error) {
      this.logger.error('Failed to find homepage items', error);
      throw new DatabaseException('Failed to find homepage items', error);
    }
  }

  async findById(id: string): Promise<PublicMediaItemRow | null> {
    try {
      const query = sql`
        SELECT * FROM public_media_items
        WHERE id = ${id}
        LIMIT 1
      `;

      const result = await this.db.execute(query);
      const rows = result as unknown as RawPublicMediaItemRow[];

      if (rows.length === 0) {
        return null;
      }

      return this.mapToDto(rows[0]);
    } catch (error) {
      this.logger.error(`Failed to find item ${id}`, error);
      throw new DatabaseException(`Failed to find item ${id}`, error);
    }
  }

  async findBySlug(slug: string): Promise<PublicMediaItemRow | null> {
    try {
      const query = sql`
        SELECT * FROM public_media_items
        WHERE slug = ${slug}
        LIMIT 1
      `;

      const result = await this.db.execute(query);
      const rows = result as unknown as RawPublicMediaItemRow[];

      if (rows.length === 0) {
        return null;
      }

      return this.mapToDto(rows[0]);
    } catch (error) {
      this.logger.error(`Failed to find item by slug ${slug}`, error);
      throw new DatabaseException(`Failed to find item by slug ${slug}`, error);
    }
  }

  async countEligible(type?: 'movie' | 'show'): Promise<number> {
    try {
      let query = sql`SELECT COUNT(*)::int as count FROM public_media_items`;

      if (type) {
        query = sql`${query} WHERE type = ${type}`;
      }

      const result = await this.db.execute(query);
      const rows = result as Array<{ count?: number | null }>;
      return rows[0]?.count ?? 0;
    } catch (error) {
      this.logger.error('Failed to count eligible items', error);
      throw new DatabaseException('Failed to count eligible items', error);
    }
  }

  /**
   * Maps raw database row to PublicMediaItemRow DTO.
   * Handles snake_case to camelCase conversion.
   * Note: watchProviders reads from watch_providers_raw for API compatibility.
   */
  private mapToDto(row: RawPublicMediaItemRow): PublicMediaItemRow {
    return {
      id: row.id,
      type: row.type,
      tmdbId: row.tmdb_id,
      imdbId: row.imdb_id,
      title: row.title,
      originalTitle: row.original_title,
      slug: row.slug,
      overview: row.overview,
      posterPath: row.poster_path,
      backdropPath: row.backdrop_path,
      videos: row.videos,
      credits: row.credits,
      watchProviders: row.watch_providers_raw,
      trendingScore: row.trending_score,
      trendingRank: row.trending_rank,
      popularity: row.popularity,
      rating: row.rating,
      voteCount: row.vote_count,
      ratingImdb: row.rating_imdb,
      ratingMetacritic: row.rating_metacritic,
      ratingRottenTomatoes: row.rating_rotten_tomatoes,
      ratingTrakt: row.rating_trakt,
      releaseDate: row.release_date ? new Date(row.release_date) : null,
      originCountries: row.origin_countries,
      originalLanguage: row.original_language,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      // Stats
      ratingoScore: row.ratingo_score,
      qualityScore: row.quality_score,
      popularityScore: row.popularity_score,
      freshnessScore: row.freshness_score,
      watchersCount: row.watchers_count,
      // Evaluation
      relevanceScore: row.relevance_score ?? 0,
      eligibilityStatus: row.eligibility_status ?? 'eligible',
    };
  }
}
