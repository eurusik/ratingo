/**
 * Media Catalog Evaluation Repository
 *
 * Repository for managing media eligibility evaluations.
 * Each evaluation is tied to a specific policyVersion.
 *
 * Key invariant: mediaItemId + policyVersion = unique evaluation
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, and, sql } from 'drizzle-orm';
import { MediaCatalogEvaluation } from '../../domain/types/policy.types';
import { EligibilityStatusType } from '../../domain/constants/evaluation.constants';
import { DatabaseException } from '../../../../common/exceptions';

export const MEDIA_CATALOG_EVALUATION_REPOSITORY = 'MEDIA_CATALOG_EVALUATION_REPOSITORY';

export interface IMediaCatalogEvaluationRepository {
  /**
   * Upserts an evaluation for a media item.
   * Creates new or updates existing evaluation for the same mediaItemId.
   */
  upsert(evaluation: MediaCatalogEvaluation): Promise<MediaCatalogEvaluation>;

  /**
   * Bulk upsert evaluations (for batch processing).
   */
  bulkUpsert(evaluations: MediaCatalogEvaluation[]): Promise<number>;

  /**
   * Finds evaluation by media item ID (latest/current).
   */
  findByMediaId(mediaItemId: string): Promise<MediaCatalogEvaluation | null>;

  /**
   * Finds evaluation by media item ID and specific policy version.
   */
  findByMediaIdAndPolicyVersion(
    mediaItemId: string,
    policyVersion: number,
  ): Promise<MediaCatalogEvaluation | null>;

  /**
   * Lists evaluations by policy version (for reports/re-evaluation).
   */
  listByPolicyVersion(
    policyVersion: number,
    options?: { limit?: number; offset?: number },
  ): Promise<MediaCatalogEvaluation[]>;

  /**
   * Finds evaluations by status (canonical lowercase).
   */
  findByStatus(
    status: EligibilityStatusType,
    options?: { limit?: number; offset?: number },
  ): Promise<MediaCatalogEvaluation[]>;

  /**
   * Counts evaluations by status for a policy version.
   */
  countByStatusAndPolicyVersion(
    policyVersion: number,
  ): Promise<Record<EligibilityStatusType, number>>;
}

@Injectable()
export class MediaCatalogEvaluationRepository implements IMediaCatalogEvaluationRepository {
  private readonly logger = new Logger(MediaCatalogEvaluationRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async upsert(evaluation: MediaCatalogEvaluation): Promise<MediaCatalogEvaluation> {
    try {
      const result = await this.db
        .insert(schema.mediaCatalogEvaluations)
        .values({
          mediaItemId: evaluation.mediaItemId,
          status: evaluation.status,
          reasons: evaluation.reasons,
          relevanceScore: evaluation.relevanceScore,
          policyVersion: evaluation.policyVersion,
          breakoutRuleId: evaluation.breakoutRuleId,
          evaluatedAt: evaluation.evaluatedAt,
          runId: evaluation.runId,
        })
        .onConflictDoUpdate({
          target: [
            schema.mediaCatalogEvaluations.mediaItemId,
            schema.mediaCatalogEvaluations.policyVersion,
          ],
          set: {
            status: evaluation.status,
            reasons: evaluation.reasons,
            relevanceScore: evaluation.relevanceScore,
            breakoutRuleId: evaluation.breakoutRuleId,
            evaluatedAt: evaluation.evaluatedAt,
            // New run_id always wins (this is "who last evaluated")
            // If evaluation.runId is undefined, we keep existing via COALESCE
            runId: evaluation.runId ?? sql`${schema.mediaCatalogEvaluations.runId}`,
          },
        })
        .returning();

      return this.mapToEntity(result[0]);
    } catch (error) {
      this.logger.error(`Failed to upsert evaluation for ${evaluation.mediaItemId}`, error);
      throw new DatabaseException('Failed to upsert evaluation', error);
    }
  }

  async bulkUpsert(evaluations: MediaCatalogEvaluation[]): Promise<number> {
    if (evaluations.length === 0) {
      return 0;
    }

    try {
      const values = evaluations.map((e) => ({
        mediaItemId: e.mediaItemId,
        status: e.status,
        reasons: e.reasons,
        relevanceScore: e.relevanceScore,
        policyVersion: e.policyVersion,
        breakoutRuleId: e.breakoutRuleId,
        evaluatedAt: e.evaluatedAt,
        runId: e.runId,
      }));

      const result = await this.db
        .insert(schema.mediaCatalogEvaluations)
        .values(values)
        .onConflictDoUpdate({
          target: [
            schema.mediaCatalogEvaluations.mediaItemId,
            schema.mediaCatalogEvaluations.policyVersion,
          ],
          set: {
            status: sql`excluded.status`,
            reasons: sql`excluded.reasons`,
            relevanceScore: sql`excluded.relevance_score`,
            breakoutRuleId: sql`excluded.breakout_rule_id`,
            evaluatedAt: sql`excluded.evaluated_at`,
            // New run_id wins, but NULL keeps existing
            runId: sql`COALESCE(excluded.run_id, ${schema.mediaCatalogEvaluations.runId})`,
          },
        })
        .returning({ mediaItemId: schema.mediaCatalogEvaluations.mediaItemId });

      this.logger.log(`Bulk upserted ${result.length} evaluations`);
      return result.length;
    } catch (error) {
      this.logger.error(`Failed to bulk upsert ${evaluations.length} evaluations`, error);
      throw new DatabaseException('Failed to bulk upsert evaluations', error);
    }
  }

  async findByMediaId(mediaItemId: string): Promise<MediaCatalogEvaluation | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.mediaCatalogEvaluations)
        .where(eq(schema.mediaCatalogEvaluations.mediaItemId, mediaItemId))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToEntity(result[0]);
    } catch (error) {
      this.logger.error(`Failed to find evaluation for ${mediaItemId}`, error);
      throw new DatabaseException('Failed to find evaluation', error);
    }
  }

  async findByMediaIdAndPolicyVersion(
    mediaItemId: string,
    policyVersion: number,
  ): Promise<MediaCatalogEvaluation | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.mediaCatalogEvaluations)
        .where(
          and(
            eq(schema.mediaCatalogEvaluations.mediaItemId, mediaItemId),
            eq(schema.mediaCatalogEvaluations.policyVersion, policyVersion),
          ),
        )
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToEntity(result[0]);
    } catch (error) {
      this.logger.error(
        `Failed to find evaluation for ${mediaItemId} at policy v${policyVersion}`,
        error,
      );
      throw new DatabaseException('Failed to find evaluation', error);
    }
  }

  async listByPolicyVersion(
    policyVersion: number,
    options?: { limit?: number; offset?: number },
  ): Promise<MediaCatalogEvaluation[]> {
    try {
      let query = this.db
        .select()
        .from(schema.mediaCatalogEvaluations)
        .where(eq(schema.mediaCatalogEvaluations.policyVersion, policyVersion));

      if (options?.limit) {
        query = query.limit(options.limit) as any;
      }
      if (options?.offset) {
        query = query.offset(options.offset) as any;
      }

      const result = await query;
      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      this.logger.error(`Failed to list evaluations for policy v${policyVersion}`, error);
      throw new DatabaseException('Failed to list evaluations', error);
    }
  }

  async findByStatus(
    status: EligibilityStatusType,
    options?: { limit?: number; offset?: number },
  ): Promise<MediaCatalogEvaluation[]> {
    try {
      let query = this.db
        .select()
        .from(schema.mediaCatalogEvaluations)
        .where(eq(schema.mediaCatalogEvaluations.status, status as any));

      if (options?.limit) {
        query = query.limit(options.limit) as any;
      }
      if (options?.offset) {
        query = query.offset(options.offset) as any;
      }

      const result = await query;
      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      this.logger.error(`Failed to find evaluations by status ${status}`, error);
      throw new DatabaseException('Failed to find evaluations by status', error);
    }
  }

  async countByStatusAndPolicyVersion(
    policyVersion: number,
  ): Promise<Record<EligibilityStatusType, number>> {
    try {
      const result = await this.db
        .select({
          status: schema.mediaCatalogEvaluations.status,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.mediaCatalogEvaluations)
        .where(eq(schema.mediaCatalogEvaluations.policyVersion, policyVersion))
        .groupBy(schema.mediaCatalogEvaluations.status);

      const counts: Record<EligibilityStatusType, number> = {
        pending: 0,
        eligible: 0,
        ineligible: 0,
        review: 0,
      };

      for (const row of result) {
        counts[row.status as EligibilityStatusType] = row.count;
      }

      return counts;
    } catch (error) {
      this.logger.error(`Failed to count evaluations for policy v${policyVersion}`, error);
      throw new DatabaseException('Failed to count evaluations', error);
    }
  }

  private mapToEntity(
    row: typeof schema.mediaCatalogEvaluations.$inferSelect,
  ): MediaCatalogEvaluation {
    return {
      mediaItemId: row.mediaItemId,
      // Status is already in canonical lowercase format from DB
      status: row.status as EligibilityStatusType,
      reasons: row.reasons,
      relevanceScore: row.relevanceScore,
      policyVersion: row.policyVersion,
      breakoutRuleId: row.breakoutRuleId,
      evaluatedAt: row.evaluatedAt,
      runId: row.runId ?? undefined,
    };
  }
}
