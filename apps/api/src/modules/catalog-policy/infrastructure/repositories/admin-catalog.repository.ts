/**
 * Admin Catalog Repository
 *
 * Full-access repository for admin endpoints.
 * Reads directly from media_items + media_catalog_evaluations tables.
 * Provides access to ALL items regardless of eligibility status.
 *
 * Use this repository ONLY for admin endpoints that need to see:
 * - INELIGIBLE items (for review/debugging)
 * - PENDING items (for data quality monitoring)
 * - Evaluation history and reasons
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';
import { DatabaseException } from '../../../../common/exceptions';
import { EligibilityStatus } from '../../domain/types/policy.types';
import { MediaType } from '../../../../common/enums/media-type.enum';

export const ADMIN_CATALOG_REPOSITORY = 'ADMIN_CATALOG_REPOSITORY';

/**
 * Media item with evaluation data for admin views.
 */
export interface MediaItemWithEvaluation {
  // Media item fields
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
  trendingScore: number | null;
  trendingRank: number | null;
  popularity: number | null;
  rating: number | null;
  releaseDate: Date | null;
  originCountries: string[] | null;
  originalLanguage: string | null;
  ingestionStatus: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  // Evaluation fields
  eligibilityStatus: EligibilityStatus | null;
  evaluationReasons: string[];
  relevanceScore: number | null;
  policyVersion: number | null;
  breakoutRuleId: string | null;
  evaluatedAt: Date | null;
}

export interface AdminQueryOptions {
  limit?: number;
  offset?: number;
  type?: MediaType;
  eligibilityStatus?: EligibilityStatus;
  includeDeleted?: boolean;
  sortBy?: 'createdAt' | 'updatedAt' | 'trendingScore' | 'relevanceScore';
  sortOrder?: 'asc' | 'desc';
}

export interface IAdminCatalogRepository {
  /**
   * Finds all media items with their evaluations.
   * Supports filtering by type, eligibility status, and pagination.
   */
  findAll(options?: AdminQueryOptions): Promise<MediaItemWithEvaluation[]>;

  /**
   * Finds a single media item by ID with full evaluation data.
   * Returns item even if INELIGIBLE or PENDING.
   */
  findById(id: string): Promise<MediaItemWithEvaluation | null>;

  /**
   * Finds media items by eligibility status.
   */
  findByEligibilityStatus(
    status: EligibilityStatus,
    options?: AdminQueryOptions,
  ): Promise<MediaItemWithEvaluation[]>;

  /**
   * Counts media items by eligibility status.
   */
  countByEligibilityStatus(): Promise<Record<EligibilityStatus, number>>;

  /**
   * Finds media items with specific evaluation reasons.
   */
  findByEvaluationReason(
    reason: string,
    options?: AdminQueryOptions,
  ): Promise<MediaItemWithEvaluation[]>;
}

@Injectable()
export class AdminCatalogRepository implements IAdminCatalogRepository {
  private readonly logger = new Logger(AdminCatalogRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async findAll(options?: AdminQueryOptions): Promise<MediaItemWithEvaluation[]> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    try {
      // Build conditions
      const conditions = [];

      if (!options?.includeDeleted) {
        conditions.push(isNull(schema.mediaItems.deletedAt));
      }

      if (options?.type) {
        conditions.push(eq(schema.mediaItems.type, options.type));
      }

      // Build query
      let query = this.db
        .select({
          // Media item fields
          id: schema.mediaItems.id,
          type: schema.mediaItems.type,
          tmdbId: schema.mediaItems.tmdbId,
          imdbId: schema.mediaItems.imdbId,
          title: schema.mediaItems.title,
          originalTitle: schema.mediaItems.originalTitle,
          slug: schema.mediaItems.slug,
          overview: schema.mediaItems.overview,
          posterPath: schema.mediaItems.posterPath,
          backdropPath: schema.mediaItems.backdropPath,
          trendingScore: schema.mediaItems.trendingScore,
          trendingRank: schema.mediaItems.trendingRank,
          popularity: schema.mediaItems.popularity,
          rating: schema.mediaItems.rating,
          releaseDate: schema.mediaItems.releaseDate,
          originCountries: schema.mediaItems.originCountries,
          originalLanguage: schema.mediaItems.originalLanguage,
          ingestionStatus: schema.mediaItems.ingestionStatus,
          createdAt: schema.mediaItems.createdAt,
          updatedAt: schema.mediaItems.updatedAt,
          deletedAt: schema.mediaItems.deletedAt,
          // Evaluation fields
          eligibilityStatus: schema.mediaCatalogEvaluations.status,
          evaluationReasons: schema.mediaCatalogEvaluations.reasons,
          relevanceScore: schema.mediaCatalogEvaluations.relevanceScore,
          policyVersion: schema.mediaCatalogEvaluations.policyVersion,
          breakoutRuleId: schema.mediaCatalogEvaluations.breakoutRuleId,
          evaluatedAt: schema.mediaCatalogEvaluations.evaluatedAt,
        })
        .from(schema.mediaItems)
        .leftJoin(
          schema.mediaCatalogEvaluations,
          eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
        );

      // Apply conditions
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }

      // Apply eligibility status filter (after join)
      if (options?.eligibilityStatus) {
        query = query.where(
          eq(schema.mediaCatalogEvaluations.status, options.eligibilityStatus.toLowerCase() as any),
        ) as any;
      }

      // Apply sorting
      const sortOrder = options?.sortOrder === 'asc' ? asc : desc;
      switch (options?.sortBy) {
        case 'createdAt':
          query = query.orderBy(sortOrder(schema.mediaItems.createdAt)) as any;
          break;
        case 'updatedAt':
          query = query.orderBy(sortOrder(schema.mediaItems.updatedAt)) as any;
          break;
        case 'trendingScore':
          query = query.orderBy(sortOrder(schema.mediaItems.trendingScore)) as any;
          break;
        case 'relevanceScore':
          query = query.orderBy(sortOrder(schema.mediaCatalogEvaluations.relevanceScore)) as any;
          break;
        default:
          query = query.orderBy(desc(schema.mediaItems.updatedAt)) as any;
      }

      // Apply pagination
      query = query.limit(limit).offset(offset) as any;

      const result = await query;
      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      this.logger.error('Failed to find all media items', error);
      throw new DatabaseException('Failed to find all media items', error);
    }
  }

  async findById(id: string): Promise<MediaItemWithEvaluation | null> {
    try {
      const result = await this.db
        .select({
          // Media item fields
          id: schema.mediaItems.id,
          type: schema.mediaItems.type,
          tmdbId: schema.mediaItems.tmdbId,
          imdbId: schema.mediaItems.imdbId,
          title: schema.mediaItems.title,
          originalTitle: schema.mediaItems.originalTitle,
          slug: schema.mediaItems.slug,
          overview: schema.mediaItems.overview,
          posterPath: schema.mediaItems.posterPath,
          backdropPath: schema.mediaItems.backdropPath,
          trendingScore: schema.mediaItems.trendingScore,
          trendingRank: schema.mediaItems.trendingRank,
          popularity: schema.mediaItems.popularity,
          rating: schema.mediaItems.rating,
          releaseDate: schema.mediaItems.releaseDate,
          originCountries: schema.mediaItems.originCountries,
          originalLanguage: schema.mediaItems.originalLanguage,
          ingestionStatus: schema.mediaItems.ingestionStatus,
          createdAt: schema.mediaItems.createdAt,
          updatedAt: schema.mediaItems.updatedAt,
          deletedAt: schema.mediaItems.deletedAt,
          // Evaluation fields
          eligibilityStatus: schema.mediaCatalogEvaluations.status,
          evaluationReasons: schema.mediaCatalogEvaluations.reasons,
          relevanceScore: schema.mediaCatalogEvaluations.relevanceScore,
          policyVersion: schema.mediaCatalogEvaluations.policyVersion,
          breakoutRuleId: schema.mediaCatalogEvaluations.breakoutRuleId,
          evaluatedAt: schema.mediaCatalogEvaluations.evaluatedAt,
        })
        .from(schema.mediaItems)
        .leftJoin(
          schema.mediaCatalogEvaluations,
          eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
        )
        .where(eq(schema.mediaItems.id, id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToEntity(result[0]);
    } catch (error) {
      this.logger.error(`Failed to find media item ${id}`, error);
      throw new DatabaseException(`Failed to find media item ${id}`, error);
    }
  }

  async findByEligibilityStatus(
    status: EligibilityStatus,
    options?: AdminQueryOptions,
  ): Promise<MediaItemWithEvaluation[]> {
    return this.findAll({
      ...options,
      eligibilityStatus: status,
    });
  }

  async countByEligibilityStatus(): Promise<Record<EligibilityStatus, number>> {
    try {
      const result = await this.db
        .select({
          status: schema.mediaCatalogEvaluations.status,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.mediaCatalogEvaluations)
        .groupBy(schema.mediaCatalogEvaluations.status);

      const counts: Record<EligibilityStatus, number> = {
        PENDING: 0,
        ELIGIBLE: 0,
        INELIGIBLE: 0,
        REVIEW: 0,
      };

      for (const row of result) {
        const status = row.status.toUpperCase() as EligibilityStatus;
        counts[status] = row.count;
      }

      return counts;
    } catch (error) {
      this.logger.error('Failed to count by eligibility status', error);
      throw new DatabaseException('Failed to count by eligibility status', error);
    }
  }

  async findByEvaluationReason(
    reason: string,
    options?: AdminQueryOptions,
  ): Promise<MediaItemWithEvaluation[]> {
    const limit = options?.limit ?? 20;
    const offset = options?.offset ?? 0;

    try {
      const conditions = [sql`${reason} = ANY(${schema.mediaCatalogEvaluations.reasons})`];

      if (!options?.includeDeleted) {
        conditions.push(isNull(schema.mediaItems.deletedAt));
      }

      if (options?.type) {
        conditions.push(eq(schema.mediaItems.type, options.type));
      }

      const result = await this.db
        .select({
          // Media item fields
          id: schema.mediaItems.id,
          type: schema.mediaItems.type,
          tmdbId: schema.mediaItems.tmdbId,
          imdbId: schema.mediaItems.imdbId,
          title: schema.mediaItems.title,
          originalTitle: schema.mediaItems.originalTitle,
          slug: schema.mediaItems.slug,
          overview: schema.mediaItems.overview,
          posterPath: schema.mediaItems.posterPath,
          backdropPath: schema.mediaItems.backdropPath,
          trendingScore: schema.mediaItems.trendingScore,
          trendingRank: schema.mediaItems.trendingRank,
          popularity: schema.mediaItems.popularity,
          rating: schema.mediaItems.rating,
          releaseDate: schema.mediaItems.releaseDate,
          originCountries: schema.mediaItems.originCountries,
          originalLanguage: schema.mediaItems.originalLanguage,
          ingestionStatus: schema.mediaItems.ingestionStatus,
          createdAt: schema.mediaItems.createdAt,
          updatedAt: schema.mediaItems.updatedAt,
          deletedAt: schema.mediaItems.deletedAt,
          // Evaluation fields
          eligibilityStatus: schema.mediaCatalogEvaluations.status,
          evaluationReasons: schema.mediaCatalogEvaluations.reasons,
          relevanceScore: schema.mediaCatalogEvaluations.relevanceScore,
          policyVersion: schema.mediaCatalogEvaluations.policyVersion,
          breakoutRuleId: schema.mediaCatalogEvaluations.breakoutRuleId,
          evaluatedAt: schema.mediaCatalogEvaluations.evaluatedAt,
        })
        .from(schema.mediaItems)
        .innerJoin(
          schema.mediaCatalogEvaluations,
          eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
        )
        .where(and(...conditions))
        .orderBy(desc(schema.mediaItems.updatedAt))
        .limit(limit)
        .offset(offset);

      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      this.logger.error(`Failed to find items by reason ${reason}`, error);
      throw new DatabaseException(`Failed to find items by reason ${reason}`, error);
    }
  }

  private mapToEntity(row: any): MediaItemWithEvaluation {
    return {
      id: row.id,
      type: row.type,
      tmdbId: row.tmdbId,
      imdbId: row.imdbId,
      title: row.title,
      originalTitle: row.originalTitle,
      slug: row.slug,
      overview: row.overview,
      posterPath: row.posterPath,
      backdropPath: row.backdropPath,
      trendingScore: row.trendingScore,
      trendingRank: row.trendingRank,
      popularity: row.popularity,
      rating: row.rating,
      releaseDate: row.releaseDate,
      originCountries: row.originCountries as string[] | null,
      originalLanguage: row.originalLanguage,
      ingestionStatus: row.ingestionStatus,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      // Evaluation fields
      eligibilityStatus: row.eligibilityStatus
        ? (row.eligibilityStatus.toUpperCase() as EligibilityStatus)
        : null,
      evaluationReasons: row.evaluationReasons ?? [],
      relevanceScore: row.relevanceScore,
      policyVersion: row.policyVersion,
      breakoutRuleId: row.breakoutRuleId,
      evaluatedAt: row.evaluatedAt,
    };
  }
}
