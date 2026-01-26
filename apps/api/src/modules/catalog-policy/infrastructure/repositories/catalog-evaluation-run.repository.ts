/**
 * Catalog Evaluation Run Repository
 *
 * Repository for managing evaluation runs with progress tracking.
 * Supports two-phase activation flow (Prepare → Promote).
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, desc, sql, and, lt } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DEFAULT_PAGE_SIZE } from '../../../../common/constants';
import { DatabaseException } from '../../../../common/exceptions';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import {
  EligibilityStatus,
  RunStatus,
  type RunStatusType,
} from '../../domain/constants/evaluation.constants';
import { InvalidRunStatusError } from '../../domain/errors/policy.errors';
import {
  type ICatalogEvaluationRunRepository,
  type CatalogEvaluationRun,
  type CreateRunInput,
  type UpdateRunInput,
  type IncrementCountersInput,
} from '../../domain/repositories';
import { type AggregatedCounters, type RunAnomaly } from '../../domain/types';

@Injectable()
export class CatalogEvaluationRunRepository implements ICatalogEvaluationRunRepository {
  private readonly logger = new Logger(CatalogEvaluationRunRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async create(input: CreateRunInput): Promise<CatalogEvaluationRun> {
    try {
      const result = await this.db
        .insert(schema.catalogEvaluationRuns)
        .values({
          targetPolicyId: input.targetPolicyId,
          targetPolicyVersion: input.targetPolicyVersion,
          baselinePolicyVersion: input.baselinePolicyVersion,
          policyVersion: input.targetPolicyVersion,
          status: RunStatus.RUNNING,
          totalReadySnapshot: input.totalReadySnapshot,
          snapshotCutoff: input.snapshotCutoff,
          processed: 0,
          eligible: 0,
          ineligible: 0,
          errors: 0,
          errorSample: [],
          startedAt: new Date(),
        })
        .returning();

      this.logger.log(`Created run ${result[0].id} for policy v${input.targetPolicyVersion}`);

      return this.mapToEntity(result[0]);
    } catch (error) {
      this.logger.error('Failed to create evaluation run', error);
      throw new DatabaseException('Failed to create evaluation run', error);
    }
  }

  async findById(id: string): Promise<CatalogEvaluationRun | null> {
    try {
      const result = await this.db
        .select()
        .from(schema.catalogEvaluationRuns)
        .where(eq(schema.catalogEvaluationRuns.id, id))
        .limit(1);

      if (result.length === 0) {
        return null;
      }

      return this.mapToEntity(result[0]);
    } catch (error) {
      this.logger.error(`Failed to find run ${id}`, error);
      throw new DatabaseException(`Failed to find run ${id}`, error);
    }
  }

  async update(id: string, updates: UpdateRunInput): Promise<void> {
    try {
      const updateData: Record<string, unknown> = {};

      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.finishedAt !== undefined) updateData.finishedAt = updates.finishedAt;
      if (updates.cursor !== undefined) updateData.cursor = updates.cursor;
      if (updates.processed !== undefined) updateData.processed = updates.processed;
      if (updates.eligible !== undefined) updateData.eligible = updates.eligible;
      if (updates.ineligible !== undefined) updateData.ineligible = updates.ineligible;
      if (updates.errors !== undefined) updateData.errors = updates.errors;
      if (updates.errorSample !== undefined) updateData.errorSample = updates.errorSample;
      if (updates.promotedAt !== undefined) updateData.promotedAt = updates.promotedAt;
      if (updates.promotedBy !== undefined) updateData.promotedBy = updates.promotedBy;

      await this.db
        .update(schema.catalogEvaluationRuns)
        .set(updateData)
        .where(eq(schema.catalogEvaluationRuns.id, id));

      this.logger.debug(`Updated run ${id}`);
    } catch (error) {
      this.logger.error(`Failed to update run ${id}`, error);
      throw new DatabaseException(`Failed to update run ${id}`, error);
    }
  }

  async findByPolicyId(policyId: string): Promise<CatalogEvaluationRun[]> {
    try {
      const result = await this.db
        .select()
        .from(schema.catalogEvaluationRuns)
        .where(eq(schema.catalogEvaluationRuns.targetPolicyId, policyId))
        .orderBy(desc(schema.catalogEvaluationRuns.startedAt));

      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      this.logger.error(`Failed to find runs for policy ${policyId}`, error);
      throw new DatabaseException(`Failed to find runs for policy ${policyId}`, error);
    }
  }

  async findByStatus(status: string): Promise<CatalogEvaluationRun[]> {
    try {
      const result = await this.db
        .select()
        .from(schema.catalogEvaluationRuns)
        .where(eq(schema.catalogEvaluationRuns.status, status as RunStatusType))
        .orderBy(desc(schema.catalogEvaluationRuns.startedAt));

      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      this.logger.error(`Failed to find runs with status ${status}`, error);
      throw new DatabaseException(`Failed to find runs with status ${status}`, error);
    }
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<CatalogEvaluationRun[]> {
    const limit = options?.limit ?? DEFAULT_PAGE_SIZE;
    const offset = options?.offset ?? 0;

    try {
      const result = await this.db
        .select()
        .from(schema.catalogEvaluationRuns)
        .orderBy(desc(schema.catalogEvaluationRuns.startedAt))
        .limit(limit)
        .offset(offset);

      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      this.logger.error('Failed to find all runs', error);
      throw new DatabaseException('Failed to find all runs', error);
    }
  }

  /**
   * Atomically increments counters using SQL.
   * Prevents race conditions when multiple workers update counters simultaneously.
   */
  async incrementCounters(id: string, increments: IncrementCountersInput): Promise<void> {
    try {
      const updates: Record<string, unknown> = {};

      if (increments.processed !== undefined) {
        updates.processed = sql`COALESCE(processed, 0) + ${increments.processed}`;
      }

      if (increments.eligible !== undefined) {
        updates.eligible = sql`COALESCE(eligible, 0) + ${increments.eligible}`;
      }

      if (increments.ineligible !== undefined) {
        updates.ineligible = sql`COALESCE(ineligible, 0) + ${increments.ineligible}`;
      }

      if (increments.errors !== undefined) {
        updates.errors = sql`COALESCE(errors, 0) + ${increments.errors}`;
      }

      await this.db
        .update(schema.catalogEvaluationRuns)
        .set(updates)
        .where(eq(schema.catalogEvaluationRuns.id, id));

      this.logger.debug(`Incremented counters for run ${id}`);
    } catch (error) {
      this.logger.error(`Failed to increment counters for run ${id}`, error);
      throw new DatabaseException(`Failed to increment counters for run ${id}`, error);
    }
  }

  /**
   * Records an error atomically: increments error counter AND appends to errorSample in ONE UPDATE.
   * Prevents inconsistent state where errors count doesn't match errorSample length.
   */
  async recordError(
    id: string,
    error: { mediaItemId: string; error: string; stack?: string; timestamp: string },
  ): Promise<void> {
    try {
      await this.db
        .update(schema.catalogEvaluationRuns)
        .set({
          errors: sql`COALESCE(errors, 0) + 1`,
          errorSample: sql`(
            SELECT COALESCE(jsonb_agg(e ORDER BY (e->>'timestamp')::timestamptz DESC), '[]'::jsonb)
            FROM (
              SELECT e
              FROM jsonb_array_elements(
                COALESCE(error_sample, '[]'::jsonb) || ${JSON.stringify(error)}::jsonb
              ) AS e
              ORDER BY (e->>'timestamp')::timestamptz DESC
              LIMIT 10
            ) s
          )`,
        })
        .where(eq(schema.catalogEvaluationRuns.id, id));

      this.logger.debug(`Recorded error for run ${id}`);
    } catch (err) {
      this.logger.error(`Failed to record error for run ${id}`, err);
      throw new DatabaseException(`Failed to record error for run ${id}`, err);
    }
  }

  /**
   * Aggregates counters from evaluations table for a specific run.
   * Uses COUNT(DISTINCT media_item_id) to avoid double-counting.
   */
  async aggregateCounters(runId: string): Promise<AggregatedCounters> {
    try {
      const result = await this.db
        .select({
          processed: sql<number>`COUNT(DISTINCT ${schema.mediaCatalogEvaluations.mediaItemId})::int`,
          eligible: sql<number>`COUNT(DISTINCT ${schema.mediaCatalogEvaluations.mediaItemId}) FILTER (WHERE ${schema.mediaCatalogEvaluations.status} = ${EligibilityStatus.ELIGIBLE})::int`,
          ineligible: sql<number>`COUNT(DISTINCT ${schema.mediaCatalogEvaluations.mediaItemId}) FILTER (WHERE ${schema.mediaCatalogEvaluations.status} = ${EligibilityStatus.INELIGIBLE})::int`,
          review: sql<number>`COUNT(DISTINCT ${schema.mediaCatalogEvaluations.mediaItemId}) FILTER (WHERE ${schema.mediaCatalogEvaluations.status} = ${EligibilityStatus.REVIEW})::int`,
        })
        .from(schema.mediaCatalogEvaluations)
        .where(eq(schema.mediaCatalogEvaluations.runId, runId));

      const counters = result[0] || { processed: 0, eligible: 0, ineligible: 0, review: 0 };

      // Get error count from run's errors column (atomic counter, source of truth)
      const run = await this.db
        .select({ errors: schema.catalogEvaluationRuns.errors })
        .from(schema.catalogEvaluationRuns)
        .where(eq(schema.catalogEvaluationRuns.id, runId))
        .limit(1);

      return {
        ...counters,
        errors: run[0]?.errors ?? 0,
      };
    } catch (error) {
      this.logger.error(`Failed to aggregate counters for run ${runId}`, error);
      throw new DatabaseException(`Failed to aggregate counters for run ${runId}`, error);
    }
  }

  /**
   * Syncs cached counters with actual aggregated values.
   * Uses atomic UPDATE with subqueries to prevent race conditions.
   */
  async syncRunCounters(runId: string): Promise<AggregatedCounters> {
    try {
      // Atomic UPDATE with subqueries - no race condition between read and write
      const result = await this.db
        .update(schema.catalogEvaluationRuns)
        .set({
          processed: sql`(
            SELECT COUNT(DISTINCT media_item_id)::int
            FROM ${schema.mediaCatalogEvaluations}
            WHERE run_id = ${runId}
          )`,
          eligible: sql`(
            SELECT COUNT(DISTINCT media_item_id)::int
            FROM ${schema.mediaCatalogEvaluations}
            WHERE run_id = ${runId} AND status = ${EligibilityStatus.ELIGIBLE}
          )`,
          ineligible: sql`(
            SELECT COUNT(DISTINCT media_item_id)::int
            FROM ${schema.mediaCatalogEvaluations}
            WHERE run_id = ${runId} AND status = ${EligibilityStatus.INELIGIBLE}
          )`,
          // errors column is not updated here - it's managed by recordError atomically
        })
        .where(eq(schema.catalogEvaluationRuns.id, runId))
        .returning({
          processed: schema.catalogEvaluationRuns.processed,
          eligible: schema.catalogEvaluationRuns.eligible,
          ineligible: schema.catalogEvaluationRuns.ineligible,
          errors: schema.catalogEvaluationRuns.errors,
        });

      // Calculate review from the difference (processed - eligible - ineligible)
      const counters: AggregatedCounters = {
        processed: result[0]?.processed ?? 0,
        eligible: result[0]?.eligible ?? 0,
        ineligible: result[0]?.ineligible ?? 0,
        review:
          (result[0]?.processed ?? 0) - (result[0]?.eligible ?? 0) - (result[0]?.ineligible ?? 0),
        errors: result[0]?.errors ?? 0,
      };

      this.logger.debug(`Synced counters for run ${runId}: ${JSON.stringify(counters)}`);

      return counters;
    } catch (error) {
      this.logger.error(`Failed to sync counters for run ${runId}`, error);
      throw new DatabaseException(`Failed to sync counters for run ${runId}`, error);
    }
  }

  /**
   * Finds runs that are RUNNING and started before the cutoff date.
   */
  async findStaleRunning(cutoff: Date): Promise<Array<{ id: string }>> {
    try {
      return await this.db
        .select({ id: schema.catalogEvaluationRuns.id })
        .from(schema.catalogEvaluationRuns)
        .where(
          and(
            eq(schema.catalogEvaluationRuns.status, RunStatus.RUNNING),
            lt(schema.catalogEvaluationRuns.startedAt, cutoff),
          ),
        );
    } catch (error) {
      this.logger.error('Failed to find stale running runs', error);
      throw new DatabaseException('Failed to find stale running runs', error);
    }
  }

  /**
   * Records an anomaly in the run's errorSample.
   */
  async recordAnomaly(runId: string, anomaly: RunAnomaly): Promise<void> {
    try {
      await this.db
        .update(schema.catalogEvaluationRuns)
        .set({
          errorSample: sql`COALESCE(error_sample, '[]'::jsonb) || ${JSON.stringify([anomaly])}::jsonb`,
        })
        .where(eq(schema.catalogEvaluationRuns.id, runId));

      this.logger.debug(`Recorded anomaly for run ${runId}: ${anomaly.type}`);
    } catch (error) {
      this.logger.error(`Failed to record anomaly for run ${runId}`, error);
      throw new DatabaseException(`Failed to record anomaly for run ${runId}`, error);
    }
  }

  /**
   * Atomically transitions a run from RUNNING to PREPARED.
   * Uses WHERE guard to prevent race conditions.
   */
  async transitionToPrepared(runId: string, counters: AggregatedCounters): Promise<boolean> {
    try {
      const result = await this.db
        .update(schema.catalogEvaluationRuns)
        .set({
          status: RunStatus.PREPARED,
          finishedAt: new Date(),
          processed: counters.processed,
          eligible: counters.eligible,
          ineligible: counters.ineligible,
          errors: counters.errors,
        })
        .where(
          and(
            eq(schema.catalogEvaluationRuns.id, runId),
            eq(schema.catalogEvaluationRuns.status, RunStatus.RUNNING),
          ),
        )
        .returning({ id: schema.catalogEvaluationRuns.id });

      return result.length > 0;
    } catch (error) {
      this.logger.error(`Failed to transition run ${runId} to PREPARED`, error);
      throw new DatabaseException(`Failed to transition run ${runId} to PREPARED`, error);
    }
  }

  private mapToEntity(row: typeof schema.catalogEvaluationRuns.$inferSelect): CatalogEvaluationRun {
    return {
      id: row.id,
      policyVersion: row.policyVersion,
      status: this.validateStatus(row.status),
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      cursor: row.cursor,
      targetPolicyId: row.targetPolicyId,
      targetPolicyVersion: row.targetPolicyVersion,
      baselinePolicyVersion: row.baselinePolicyVersion,
      totalReadySnapshot: row.totalReadySnapshot ?? 0,
      snapshotCutoff: row.snapshotCutoff,
      processed: row.processed ?? 0,
      eligible: row.eligible ?? 0,
      ineligible: row.ineligible ?? 0,
      errors: row.errors ?? 0,
      errorSample: (row.errorSample as CatalogEvaluationRun['errorSample']) ?? [],
      promotedAt: row.promotedAt,
      promotedBy: row.promotedBy,
    };
  }

  /**
   * Validates run status is in canonical set.
   * Throws InvalidRunStatusError for legacy or unknown values.
   *
   * Valid values: 'running', 'prepared', 'failed', 'cancelled', 'promoted'.
   * Legacy values ('pending', 'success', 'completed') must be migrated at DB level.
   */
  private validateStatus(status: string): RunStatusType {
    const validStatuses: RunStatusType[] = [
      RunStatus.RUNNING,
      RunStatus.PREPARED,
      RunStatus.FAILED,
      RunStatus.CANCELLED,
      RunStatus.PROMOTED,
    ];

    if (!validStatuses.includes(status as RunStatusType)) {
      throw new InvalidRunStatusError(status);
    }

    return status as RunStatusType;
  }
}
