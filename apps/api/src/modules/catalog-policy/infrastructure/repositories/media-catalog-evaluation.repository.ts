/**
 * Media Catalog Evaluation Repository
 *
 * Infrastructure implementation for managing media eligibility evaluations.
 * Each evaluation is tied to a specific policyVersion AND context.
 *
 * Key invariant: mediaItemId + policyVersion + context = unique evaluation
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, and, sql, inArray } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DatabaseException } from '../../../../common/exceptions';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  type EligibilityStatusType,
  DEFAULT_EVALUATION_CONTEXT,
  type EvaluationContextType,
} from '../../domain/constants/evaluation.constants';
import {
  type IMediaCatalogEvaluationRepository,
  MEDIA_CATALOG_EVALUATION_REPOSITORY,
} from '../../domain/repositories/media-catalog-evaluation.repository.interface';
import { type MediaCatalogEvaluation } from '../../domain/types/policy.types';

// Re-export for backward compatibility
export { MEDIA_CATALOG_EVALUATION_REPOSITORY, type IMediaCatalogEvaluationRepository };

@Injectable()
export class MediaCatalogEvaluationRepository implements IMediaCatalogEvaluationRepository {
  private readonly logger = new Logger(MediaCatalogEvaluationRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async upsert(evaluation: MediaCatalogEvaluation): Promise<MediaCatalogEvaluation> {
    const context = evaluation.context ?? DEFAULT_EVALUATION_CONTEXT;
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
          context,
        })
        .onConflictDoUpdate({
          target: [
            schema.mediaCatalogEvaluations.mediaItemId,
            schema.mediaCatalogEvaluations.policyVersion,
            schema.mediaCatalogEvaluations.context,
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
        context: e.context ?? DEFAULT_EVALUATION_CONTEXT,
      }));

      const result = await this.db
        .insert(schema.mediaCatalogEvaluations)
        .values(values)
        .onConflictDoUpdate({
          target: [
            schema.mediaCatalogEvaluations.mediaItemId,
            schema.mediaCatalogEvaluations.policyVersion,
            schema.mediaCatalogEvaluations.context,
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

  async findByMediaId(
    mediaItemId: string,
    context: EvaluationContextType = DEFAULT_EVALUATION_CONTEXT,
  ): Promise<MediaCatalogEvaluation | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.mediaCatalogEvaluations)
        .where(
          and(
            eq(schema.mediaCatalogEvaluations.mediaItemId, mediaItemId),
            eq(schema.mediaCatalogEvaluations.context, context),
          ),
        )
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

  async findByMediaIdForContexts(
    mediaItemId: string,
    contexts: EvaluationContextType[],
  ): Promise<Map<EvaluationContextType, MediaCatalogEvaluation>> {
    const resultMap = new Map<EvaluationContextType, MediaCatalogEvaluation>();

    if (contexts.length === 0) {
      return resultMap;
    }

    try {
      const result = await this.db
        .select()
        .from(schema.mediaCatalogEvaluations)
        .where(
          and(
            eq(schema.mediaCatalogEvaluations.mediaItemId, mediaItemId),
            inArray(schema.mediaCatalogEvaluations.context, contexts),
          ),
        );

      for (const row of result) {
        const entity = this.mapToEntity(row);
        resultMap.set(entity.context, entity);
      }

      return resultMap;
    } catch (error) {
      this.logger.error(`Failed to find evaluations for ${mediaItemId} across contexts`, error);
      throw new DatabaseException('Failed to find evaluations for contexts', error);
    }
  }

  async findByMediaIdAndPolicyVersion(
    mediaItemId: string,
    policyVersion: number,
    context: EvaluationContextType = DEFAULT_EVALUATION_CONTEXT,
  ): Promise<MediaCatalogEvaluation | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.mediaCatalogEvaluations)
        .where(
          and(
            eq(schema.mediaCatalogEvaluations.mediaItemId, mediaItemId),
            eq(schema.mediaCatalogEvaluations.policyVersion, policyVersion),
            eq(schema.mediaCatalogEvaluations.context, context),
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
    options?: { limit?: number; offset?: number; context?: EvaluationContextType },
  ): Promise<MediaCatalogEvaluation[]> {
    const context = options?.context ?? DEFAULT_EVALUATION_CONTEXT;
    try {
      let query = this.db
        .select()
        .from(schema.mediaCatalogEvaluations)
        .where(
          and(
            eq(schema.mediaCatalogEvaluations.policyVersion, policyVersion),
            eq(schema.mediaCatalogEvaluations.context, context),
          ),
        );

      if (options?.limit) {
        query = query.limit(options.limit) as typeof query;
      }
      if (options?.offset) {
        query = query.offset(options.offset) as typeof query;
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
    options?: { limit?: number; offset?: number; context?: EvaluationContextType },
  ): Promise<MediaCatalogEvaluation[]> {
    const context = options?.context ?? DEFAULT_EVALUATION_CONTEXT;
    try {
      let query = this.db
        .select()
        .from(schema.mediaCatalogEvaluations)
        .where(
          and(
            eq(schema.mediaCatalogEvaluations.status, status),
            eq(schema.mediaCatalogEvaluations.context, context),
          ),
        );

      if (options?.limit) {
        query = query.limit(options.limit) as typeof query;
      }
      if (options?.offset) {
        query = query.offset(options.offset) as typeof query;
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
    context: EvaluationContextType = DEFAULT_EVALUATION_CONTEXT,
  ): Promise<Record<EligibilityStatusType, number>> {
    try {
      const result = await this.db
        .select({
          status: schema.mediaCatalogEvaluations.status,
          count: sql<number>`count(*)::int`,
        })
        .from(schema.mediaCatalogEvaluations)
        .where(
          and(
            eq(schema.mediaCatalogEvaluations.policyVersion, policyVersion),
            eq(schema.mediaCatalogEvaluations.context, context),
          ),
        )
        .groupBy(schema.mediaCatalogEvaluations.status);

      const counts: Record<EligibilityStatusType, number> = {
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
      context: row.context as EvaluationContextType,
    };
  }
}
