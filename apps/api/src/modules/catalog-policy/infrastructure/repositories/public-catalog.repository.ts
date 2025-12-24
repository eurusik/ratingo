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
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { sql } from 'drizzle-orm';
import { DatabaseException } from '../../../../common/exceptions';
import {
  Credits,
  WatchProvidersMap,
} from '../../../ingestion/domain/models/normalized-media.model';

export const PUBLIC_CATALOG_REPOSITORY = 'PUBLIC_CATALOG_REPOSITORY';

/**
 * DTO for rows returned from public_media_items view.
 * Single source of truth for public catalog data shape.
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
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    try {
      let query = sql`
        SELECT * FROM public_media_items
        WHERE 1=1
      `;

      if (options?.type) {
        query = sql`${query} AND type = ${options.type}`;
      }

      query = sql`${query} 
        ORDER BY trending_score DESC NULLS LAST, trending_rank ASC NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `;

      const result = await this.db.execute(query);
      return (result as any[]).map((row) => this.mapToDto(row));
    } catch (error) {
      this.logger.error('Failed to find trending items', error);
      throw new DatabaseException('Failed to find trending items', error);
    }
  }

  async search(query: string, options?: SearchOptions): Promise<PublicMediaItemRow[]> {
    const limit = options?.limit ?? 20;
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
      return (result as any[]).map((row) => this.mapToDto(row));
    } catch (error) {
      this.logger.error(`Failed to search for "${query}"`, error);
      throw new DatabaseException('Failed to search catalog', error);
    }
  }

  async findForHomepage(options?: HomepageOptions): Promise<PublicMediaItemRow[]> {
    const minRelevanceScore = options?.minRelevanceScore ?? 50;
    const limit = options?.limit ?? 20;

    try {
      const query = sql`
        SELECT * FROM public_media_items
        WHERE relevance_score >= ${minRelevanceScore}
        ORDER BY relevance_score DESC, trending_score DESC NULLS LAST
        LIMIT ${limit}
      `;

      const result = await this.db.execute(query);
      return (result as any[]).map((row) => this.mapToDto(row));
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
      const rows = result as any[];

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
      const rows = result as any[];

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
   */
  private mapToDto(row: any): PublicMediaItemRow {
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
      watchProviders: row.watch_providers,
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
