/**
 * Policy Activation Repository
 *
 * Handles transactional operations for policy activation flow.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import { eq, and, isNull, lte, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DatabaseException } from '../../../../common/exceptions';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { RunStatus } from '../../domain/constants/evaluation.constants';
import { InvalidRunStateTransitionError } from '../../domain/errors';
import {
  type IPolicyActivationRepository,
  type CreateRunWithSnapshotInput,
  type CreateRunWithSnapshotResult,
  type PromoteRunInput,
} from '../../domain/repositories';

@Injectable()
export class PolicyActivationRepository implements IPolicyActivationRepository {
  private readonly logger = new Logger(PolicyActivationRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async createRunWithSnapshot(
    input: CreateRunWithSnapshotInput,
  ): Promise<CreateRunWithSnapshotResult> {
    const snapshotCutoff = new Date();

    try {
      return await this.db.transaction(async (tx) => {
        const activePolicyResult = await tx
          .select({ version: schema.catalogPolicies.version })
          .from(schema.catalogPolicies)
          .where(eq(schema.catalogPolicies.isActive, true))
          .limit(1);

        const baselinePolicyVersion = activePolicyResult[0]?.version ?? null;

        const countResult = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(schema.mediaItems)
          .where(
            and(
              eq(schema.mediaItems.ingestionStatus, 'ready'),
              isNull(schema.mediaItems.deletedAt),
              lte(schema.mediaItems.updatedAt, snapshotCutoff),
            ),
          );

        const totalReadySnapshot = countResult[0]?.count || 0;

        const runResult = await tx
          .insert(schema.catalogEvaluationRuns)
          .values({
            targetPolicyId: input.targetPolicyId,
            targetPolicyVersion: input.targetPolicyVersion,
            baselinePolicyVersion,
            policyVersion: input.targetPolicyVersion,
            status: RunStatus.RUNNING,
            totalReadySnapshot,
            snapshotCutoff,
            processed: 0,
            eligible: 0,
            ineligible: 0,
            errors: 0,
            errorSample: [],
            startedAt: new Date(),
          })
          .returning({ id: schema.catalogEvaluationRuns.id });

        this.logger.log(
          `Created run ${runResult[0].id} with snapshot: ${totalReadySnapshot} items`,
        );

        return {
          runId: runResult[0].id,
          baselinePolicyVersion,
          totalReadySnapshot,
          snapshotCutoff,
        };
      });
    } catch (error) {
      this.logger.error('Failed to create run with snapshot', error);
      throw new DatabaseException('Failed to create run with snapshot', error);
    }
  }

  async promoteRun(input: PromoteRunInput): Promise<void> {
    try {
      await this.db.transaction(async (tx) => {
        // Deactivate currently active policy
        await tx
          .update(schema.catalogPolicies)
          .set({ isActive: false, activatedAt: null })
          .where(eq(schema.catalogPolicies.isActive, true));

        // Activate target policy
        await tx
          .update(schema.catalogPolicies)
          .set({ isActive: true, activatedAt: new Date() })
          .where(eq(schema.catalogPolicies.id, input.targetPolicyId));

        // Update run status with optimistic lock on PREPARED state
        const runUpdateResult = await tx
          .update(schema.catalogEvaluationRuns)
          .set({
            status: input.newStatus,
            promotedAt: new Date(),
            promotedBy: input.promotedBy,
          })
          .where(
            and(
              eq(schema.catalogEvaluationRuns.id, input.runId),
              eq(schema.catalogEvaluationRuns.status, RunStatus.PREPARED),
            ),
          )
          .returning({ id: schema.catalogEvaluationRuns.id });

        if (runUpdateResult.length === 0) {
          throw new InvalidRunStateTransitionError(input.runId, 'not PREPARED', 'promote');
        }
      });

      this.logger.log(`Promoted run ${input.runId}, activated policy ${input.targetPolicyId}`);
    } catch (error) {
      if (error instanceof InvalidRunStateTransitionError) {
        throw error;
      }
      this.logger.error(`Failed to promote run ${input.runId}`, error);
      throw new DatabaseException(`Failed to promote run ${input.runId}`, error);
    }
  }

  async countReadyMediaItems(cutoffDate: Date): Promise<number> {
    try {
      const result = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.mediaItems)
        .where(
          and(
            eq(schema.mediaItems.ingestionStatus, 'ready'),
            isNull(schema.mediaItems.deletedAt),
            lte(schema.mediaItems.updatedAt, cutoffDate),
          ),
        );

      return result[0]?.count || 0;
    } catch (error) {
      this.logger.error('Failed to count ready media items', error);
      throw new DatabaseException('Failed to count ready media items', error);
    }
  }
}
