/**
 * Admin Catalog Repository
 *
 * Full-access repository for admin endpoints.
 * Reads directly from media_items + media_catalog_evaluations tables.
 * Provides access to ALL items regardless of eligibility status.
 *
 * Use this repository ONLY for admin endpoints that need to see:
 * - INELIGIBLE items (for review/debugging)
 * - Evaluation history and reasons
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, and, isNull, desc, asc, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DEFAULT_PAGE_SIZE } from '../../../../common/constants';
import { type MediaType } from '../../../../common/enums/media-type.enum';
import { DatabaseException } from '../../../../common/exceptions';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  DEFAULT_EVALUATION_CONTEXT,
  type EligibilityStatusType,
} from '../../domain/constants/evaluation.constants';

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
  // Evaluation fields (canonical lowercase status)
  eligibilityStatus: EligibilityStatusType | null;
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
  eligibilityStatus?: EligibilityStatusType;
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
   * Returns item even if INELIGIBLE.
   */
  findById(id: string): Promise<MediaItemWithEvaluation | null>;

  /**
   * Finds media items by eligibility status.
   */
  findByEligibilityStatus(
    status: EligibilityStatusType,
    options?: AdminQueryOptions,
  ): Promise<MediaItemWithEvaluation[]>;

  /**
   * Counts media items by eligibility status.
   */
  countByEligibilityStatus(): Promise<Record<EligibilityStatusType, number>>;

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

  /**
   * Shared select fields for media item with evaluation data.
   * Prevents duplication across query methods.
   */
  private readonly selectFields = {
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
  };

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async findAll(options?: AdminQueryOptions): Promise<MediaItemWithEvaluation[]> {
    const limit = options?.limit ?? DEFAULT_PAGE_SIZE;
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

      if (options?.eligibilityStatus) {
        conditions.push(eq(schema.mediaCatalogEvaluations.status, options.eligibilityStatus));
      }

      // Build query — restrict JOIN to active policy + catalog context to avoid duplicate rows
      let query = this.db
        .select(this.selectFields)
        .from(schema.mediaItems)
        .leftJoin(
          schema.mediaCatalogEvaluations,
          and(
            eq(schema.mediaItems.id, schema.mediaCatalogEvaluations.mediaItemId),
            eq(
              schema.mediaCatalogEvaluations.policyVersion,
              sql`(SELECT version FROM catalog_policies WHERE is_active = true LIMIT 1)`,
            ),
            eq(schema.mediaCatalogEvaluations.context, DEFAULT_EVALUATION_CONTEXT),
          ),
        );

      // Apply conditions
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      // Apply sorting
      const sortOrder = options?.sortOrder === 'asc' ? asc : desc;
      switch (options?.sortBy) {
        case 'createdAt':
          query = query.orderBy(sortOrder(schema.mediaItems.createdAt)) as typeof query;
          break;
        case 'updatedAt':
          query = query.orderBy(sortOrder(schema.mediaItems.updatedAt)) as typeof query;
          break;
        case 'trendingScore':
          query = query.orderBy(sortOrder(schema.mediaItems.trendingScore)) as typeof query;
          break;
        case 'relevanceScore':
          query = query.orderBy(
            sortOrder(schema.mediaCatalogEvaluations.relevanceScore),
          ) as typeof query;
          break;
        default:
          query = query.orderBy(desc(schema.mediaItems.updatedAt)) as typeof query;
      }

      // Apply pagination
      query = query.limit(limit).offset(offset) as typeof query;

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
        .select(this.selectFields)
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
    status: EligibilityStatusType,
    options?: AdminQueryOptions,
  ): Promise<MediaItemWithEvaluation[]> {
    return this.findAll({
      ...options,
      eligibilityStatus: status,
    });
  }

  async countByEligibilityStatus(): Promise<Record<EligibilityStatusType, number>> {
    try {
      const result = await this.db
        .select({
          status: schema.mediaCatalogEvaluations.status,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.mediaCatalogEvaluations)
        .groupBy(schema.mediaCatalogEvaluations.status);

      const counts: Record<EligibilityStatusType, number> = {
        eligible: 0,
        ineligible: 0,
        review: 0,
      };

      for (const row of result) {
        const status = row.status as EligibilityStatusType;
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
    const limit = options?.limit ?? DEFAULT_PAGE_SIZE;
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
        .select(this.selectFields)
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

  private mapToEntity(
    row: typeof this.selectFields extends infer T ? { [K in keyof T]: unknown } : never,
  ): MediaItemWithEvaluation {
    return {
      id: row.id as string,
      type: row.type as 'movie' | 'show',
      tmdbId: row.tmdbId as number,
      imdbId: row.imdbId as string | null,
      title: row.title as string,
      originalTitle: row.originalTitle as string | null,
      slug: row.slug as string,
      overview: row.overview as string | null,
      posterPath: row.posterPath as string | null,
      backdropPath: row.backdropPath as string | null,
      trendingScore: row.trendingScore as number | null,
      trendingRank: row.trendingRank as number | null,
      popularity: row.popularity as number | null,
      rating: row.rating as number | null,
      releaseDate: row.releaseDate as Date | null,
      originCountries: row.originCountries as string[] | null,
      originalLanguage: row.originalLanguage as string | null,
      ingestionStatus: row.ingestionStatus as string,
      createdAt: row.createdAt as Date,
      updatedAt: row.updatedAt as Date,
      deletedAt: row.deletedAt as Date | null,
      // Evaluation fields - status is already in canonical lowercase format
      eligibilityStatus: row.eligibilityStatus as EligibilityStatusType | null,
      evaluationReasons: (row.evaluationReasons as string[]) ?? [],
      relevanceScore: row.relevanceScore as number | null,
      policyVersion: row.policyVersion as number | null,
      breakoutRuleId: row.breakoutRuleId as string | null,
      evaluatedAt: row.evaluatedAt as Date | null,
    };
  }
}
