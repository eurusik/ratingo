/**
 * Catalog Evaluation Run Repository
 *
 * Repository for managing evaluation runs with progress tracking.
 * Supports two-phase activation flow (Prepare → Promote).
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { DatabaseException } from '../../../../common/exceptions';
import { RunStatus, RunStatusType } from '../../domain/constants/evaluation.constants';

export const CATALOG_EVALUATION_RUN_REPOSITORY = 'CATALOG_EVALUATION_RUN_REPOSITORY';

export interface CatalogEvaluationRun {
  id: string;
  policyVersion: number;
  status: RunStatusType;
  startedAt: Date;
  finishedAt: Date | null;
  cursor: string | null;
  // Policy Activation Flow fields
  targetPolicyId: string | null;
  targetPolicyVersion: number | null;
  totalReadySnapshot: number;
  snapshotCutoff: Date | null;
  processed: number;
  eligible: number;
  ineligible: number;
  pending: number;
  errors: number;
  errorSample: Array<{
    mediaItemId: string;
    error: string;
    stack?: string;
    timestamp: string;
  }>;
  promotedAt: Date | null;
  promotedBy: string | null;
}

export interface CreateRunInput {
  targetPolicyId: string;
  targetPolicyVersion: number;
  totalReadySnapshot: number;
  snapshotCutoff: Date;
}

export interface UpdateRunInput {
  status?: RunStatusType;
  finishedAt?: Date;
  cursor?: string;
  processed?: number;
  eligible?: number;
  ineligible?: number;
  pending?: number;
  errors?: number;
  errorSample?: Array<{
    mediaItemId: string;
    error: string;
    stack?: string;
    timestamp: string;
  }>;
  promotedAt?: Date;
  promotedBy?: string;
}

export interface IncrementCountersInput {
  processed?: number;
  eligible?: number;
  ineligible?: number;
  pending?: number;
  errors?: number;
}

export interface ICatalogEvaluationRunRepository {
  /**
   * Creates a new evaluation run.
   */
  create(input: CreateRunInput): Promise<CatalogEvaluationRun>;

  /**
   * Finds a run by ID.
   */
  findById(id: string): Promise<CatalogEvaluationRun | null>;

  /**
   * Updates a run.
   */
  update(id: string, updates: UpdateRunInput): Promise<void>;

  /**
   * Atomically increments counters (prevents race conditions).
   */
  incrementCounters(id: string, increments: IncrementCountersInput): Promise<void>;

  /**
   * Appends error to errorSample (max 10 errors).
   * @deprecated Use recordError() instead
   */
  appendError(
    id: string,
    error: { mediaItemId: string; error: string; stack?: string; timestamp: string },
  ): Promise<void>;

  /**
   * Records error atomically: increments errors counter AND appends to errorSample in one UPDATE.
   */
  recordError(
    id: string,
    error: { mediaItemId: string; error: string; stack?: string; timestamp: string },
  ): Promise<void>;

  /**
   * Finds runs by policy ID.
   */
  findByPolicyId(policyId: string): Promise<CatalogEvaluationRun[]>;

  /**
   * Finds runs by status.
   */
  findByStatus(status: string): Promise<CatalogEvaluationRun[]>;

  /**
   * Finds all runs with optional pagination.
   */
  findAll(options?: { limit?: number; offset?: number }): Promise<CatalogEvaluationRun[]>;
}

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
          policyVersion: input.targetPolicyVersion,
          status: RunStatus.RUNNING,
          totalReadySnapshot: input.totalReadySnapshot,
          snapshotCutoff: input.snapshotCutoff,
          processed: 0,
          eligible: 0,
          ineligible: 0,
          pending: 0,
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
      const updateData: any = {};

      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.finishedAt !== undefined) updateData.finishedAt = updates.finishedAt;
      if (updates.cursor !== undefined) updateData.cursor = updates.cursor;
      if (updates.processed !== undefined) updateData.processed = updates.processed;
      if (updates.eligible !== undefined) updateData.eligible = updates.eligible;
      if (updates.ineligible !== undefined) updateData.ineligible = updates.ineligible;
      if (updates.pending !== undefined) updateData.pending = updates.pending;
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
        .where(eq(schema.catalogEvaluationRuns.status, status as any))
        .orderBy(desc(schema.catalogEvaluationRuns.startedAt));

      return result.map((row) => this.mapToEntity(row));
    } catch (error) {
      this.logger.error(`Failed to find runs with status ${status}`, error);
      throw new DatabaseException(`Failed to find runs with status ${status}`, error);
    }
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<CatalogEvaluationRun[]> {
    const limit = options?.limit ?? 20;
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
      const updates: any = {};

      if (increments.processed !== undefined) {
        updates.processed = sql`COALESCE(processed, 0) + ${increments.processed}`;
      }

      if (increments.eligible !== undefined) {
        updates.eligible = sql`COALESCE(eligible, 0) + ${increments.eligible}`;
      }

      if (increments.ineligible !== undefined) {
        updates.ineligible = sql`COALESCE(ineligible, 0) + ${increments.ineligible}`;
      }

      if (increments.pending !== undefined) {
        updates.pending = sql`COALESCE(pending, 0) + ${increments.pending}`;
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
   * @deprecated Use recordError() instead for atomic error recording
   * Appends error to errorSample array (keeps last 10).
   * Uses SQL array operations to avoid race conditions.
   */
  async appendError(
    id: string,
    error: { mediaItemId: string; error: string; stack?: string; timestamp: string },
  ): Promise<void> {
    try {
      await this.db
        .update(schema.catalogEvaluationRuns)
        .set({
          errorSample: sql`(
            SELECT array_to_json(
              ARRAY(
                SELECT * FROM (
                  SELECT jsonb_array_elements(
                    COALESCE(error_sample, '[]'::jsonb) || ${JSON.stringify(error)}::jsonb
                  ) 
                  ORDER BY (value->>'timestamp')::timestamp DESC
                  LIMIT 10
                ) t
              )
            )::jsonb
          )`,
        })
        .where(eq(schema.catalogEvaluationRuns.id, id));

      this.logger.debug(`Appended error to run ${id}`);
    } catch (error) {
      this.logger.error(`Failed to append error to run ${id}`, error);
      throw new DatabaseException(`Failed to append error to run ${id}`, error);
    }
  }

  private mapToEntity(row: typeof schema.catalogEvaluationRuns.$inferSelect): CatalogEvaluationRun {
    return {
      id: row.id,
      policyVersion: row.policyVersion,
      status: this.normalizeStatus(row.status),
      startedAt: row.startedAt,
      finishedAt: row.finishedAt,
      cursor: row.cursor,
      targetPolicyId: row.targetPolicyId,
      targetPolicyVersion: row.targetPolicyVersion,
      totalReadySnapshot: row.totalReadySnapshot ?? 0,
      snapshotCutoff: row.snapshotCutoff,
      processed: row.processed ?? 0,
      eligible: row.eligible ?? 0,
      ineligible: row.ineligible ?? 0,
      pending: row.pending ?? 0,
      errors: row.errors ?? 0,
      errorSample: (row.errorSample as any) ?? [],
      promotedAt: row.promotedAt,
      promotedBy: row.promotedBy,
    };
  }

  /**
   * Normalizes legacy status values to current status values.
   * Maps legacy statuses to their modern equivalents:
   * - 'completed' → 'prepared'
   * - 'success' → 'prepared'
   * - 'pending' → 'running'
   */
  private normalizeStatus(status: string): RunStatusType {
    switch (status) {
      case 'completed':
      case 'success':
        return RunStatus.PREPARED;
      case 'pending':
        return RunStatus.RUNNING;
      default:
        return status as RunStatusType;
    }
  }
}
