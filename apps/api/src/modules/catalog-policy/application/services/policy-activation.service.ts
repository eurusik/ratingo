/**
 * Policy Activation Service
 *
 * Implements two-phase policy activation flow (Prepare → Promote).
 * Ensures safe policy changes without showing mixed catalog states.
 *
 * Phase 1 (Prepare): Pre-compute all evaluations for new policy version
 * Phase 2 (Promote): Atomically switch active policy after verification
 */

import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import { eq, and, isNull, lte, sql } from 'drizzle-orm';
import {
  ICatalogPolicyRepository,
  CATALOG_POLICY_REPOSITORY,
} from '../../infrastructure/repositories/catalog-policy.repository';
import {
  ICatalogEvaluationRunRepository,
  CATALOG_EVALUATION_RUN_REPOSITORY,
} from '../../infrastructure/repositories/catalog-evaluation-run.repository';
import { CATALOG_POLICY_QUEUE, CATALOG_POLICY_JOBS } from '../../catalog-policy.constants';
import {
  RunStatus as RunStatusEnum,
  RunStatusType,
  CANCELLABLE_RUN_STATUSES,
} from '../../domain/constants/evaluation.constants';

export interface PrepareOptions {
  batchSize?: number; // default: 500
  concurrency?: number; // default: 10
}

export interface PromoteOptions {
  coverageThreshold?: number; // default: 1.0 (100%)
  maxErrors?: number; // default: 0
}

export type BlockingReason =
  | 'RUN_NOT_SUCCESS'
  | 'COVERAGE_NOT_MET'
  | 'ERRORS_EXCEEDED'
  | 'ALREADY_PROMOTED';

export interface RunStatus {
  id: string;
  targetPolicyId: string;
  targetPolicyVersion: number;
  status: RunStatusType;
  totalReadySnapshot: number;
  processed: number;
  eligible: number;
  ineligible: number;
  pending: number;
  errors: number;
  startedAt: Date;
  finishedAt: Date | null;
  promotedAt: Date | null;
  promotedBy: string | null;
  readyToPromote: boolean;
  blockingReasons: BlockingReason[];
  coverage: number;
}

@Injectable()
export class PolicyActivationService {
  private readonly logger = new Logger(PolicyActivationService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @Inject(CATALOG_POLICY_REPOSITORY)
    private readonly policyRepository: ICatalogPolicyRepository,
    @Inject(CATALOG_EVALUATION_RUN_REPOSITORY)
    private readonly runRepository: ICatalogEvaluationRunRepository,
    @InjectQueue(CATALOG_POLICY_QUEUE)
    private readonly catalogQueue: Queue,
  ) {}

  /**
   * Phase 1: Prepare policy activation
   * Creates run and starts RE_EVALUATE_ALL job to pre-compute evaluations.
   *
   * @param policyId - Policy to prepare for activation
   * @param options - Batch size and concurrency settings
   * @returns Run ID and initial status
   */
  async preparePolicy(
    policyId: string,
    options?: PrepareOptions,
  ): Promise<{ runId: string; status: string }> {
    // 1. Verify policy exists
    const policy = await this.policyRepository.findById(policyId);
    if (!policy) {
      throw new NotFoundException(`Policy ${policyId} not found`);
    }

    // 2. Check policy is not already active
    if (policy.isActive) {
      throw new BadRequestException(`Policy ${policyId} is already active`);
    }

    // 3. Check no RUNNING run exists for this policy
    const existingRuns = await this.runRepository.findByPolicyId(policyId);
    const runningRun = existingRuns.find((run) => run.status === RunStatusEnum.RUNNING);
    if (runningRun) {
      throw new BadRequestException(
        `A run is already in progress for this policy (runId: ${runningRun.id})`,
      );
    }

    // 4. Calculate totalReadySnapshot and snapshotCutoff
    const snapshotCutoff = new Date();
    const totalReadySnapshot = await this.countReadyMediaItems(snapshotCutoff);

    this.logger.log(`Preparing policy v${policy.version}: ${totalReadySnapshot} items in snapshot`);

    // 5. Create run with status=RUNNING
    const run = await this.runRepository.create({
      targetPolicyId: policyId,
      targetPolicyVersion: policy.version,
      totalReadySnapshot,
      snapshotCutoff,
    });

    // 6. Queue RE_EVALUATE_ALL job
    await this.catalogQueue.add(
      CATALOG_POLICY_JOBS.RE_EVALUATE_ALL,
      {
        runId: run.id,
        policyVersion: policy.version,
        batchSize: options?.batchSize || 500,
      },
      {
        jobId: `reeval:${policy.version}:${run.id}`,
      },
    );

    this.logger.log(
      `Created run ${run.id} for policy v${policy.version} and queued RE_EVALUATE_ALL job`,
    );

    return {
      runId: run.id,
      status: RunStatusEnum.RUNNING,
    };
  }

  /**
   * Get run status with progress and readyToPromote flag.
   *
   * @param runId - Run ID to check
   * @returns Run status with computed flags
   */
  async getRunStatus(runId: string): Promise<RunStatus> {
    const run = await this.runRepository.findById(runId);
    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    // Calculate coverage
    const coverage = run.totalReadySnapshot > 0 ? run.processed / run.totalReadySnapshot : 0;

    // Calculate readyToPromote and blockingReasons
    const blockingReasons: BlockingReason[] = [];

    if (run.status !== RunStatusEnum.SUCCESS) {
      blockingReasons.push('RUN_NOT_SUCCESS');
    }

    if (coverage < 1.0) {
      blockingReasons.push('COVERAGE_NOT_MET');
    }

    if (run.errors > 0) {
      blockingReasons.push('ERRORS_EXCEEDED');
    }

    if (run.promotedAt !== null) {
      blockingReasons.push('ALREADY_PROMOTED');
    }

    const readyToPromote = blockingReasons.length === 0;

    return {
      id: run.id,
      targetPolicyId: run.targetPolicyId!,
      targetPolicyVersion: run.targetPolicyVersion!,
      status: run.status,
      totalReadySnapshot: run.totalReadySnapshot,
      processed: run.processed,
      eligible: run.eligible,
      ineligible: run.ineligible,
      pending: run.pending,
      errors: run.errors,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      promotedAt: run.promotedAt,
      promotedBy: run.promotedBy,
      readyToPromote,
      blockingReasons,
      coverage,
    };
  }

  /**
   * Phase 2: Promote run to activate policy
   * Verifies run is SUCCESS and meets thresholds, then atomically switches active policy.
   *
   * @param runId - Run ID to promote
   * @param options - Coverage and error thresholds
   * @returns Success status or error message
   */
  async promoteRun(
    runId: string,
    options?: PromoteOptions,
  ): Promise<{ success: boolean; error?: string }> {
    const coverageThreshold = options?.coverageThreshold ?? 1.0; // 100% default
    const maxErrors = options?.maxErrors ?? 0; // 0 errors default

    // 1. Fetch run
    const run = await this.runRepository.findById(runId);
    if (!run) {
      return { success: false, error: `Run ${runId} not found` };
    }

    // 2. Verify status=SUCCESS
    if (run.status !== RunStatusEnum.SUCCESS) {
      return {
        success: false,
        error: `Run status is ${run.status}, expected ${RunStatusEnum.SUCCESS}`,
      };
    }

    // 3. Check coverage threshold
    const coverage = run.totalReadySnapshot > 0 ? run.processed / run.totalReadySnapshot : 0;

    if (coverage < coverageThreshold) {
      return {
        success: false,
        error: `Coverage ${(coverage * 100).toFixed(1)}% is below threshold ${(coverageThreshold * 100).toFixed(1)}%`,
      };
    }

    // 4. Check error threshold
    if (run.errors > maxErrors) {
      return {
        success: false,
        error: `Errors ${run.errors} exceed threshold ${maxErrors}`,
      };
    }

    // 5. Check not already promoted
    if (run.promotedAt !== null) {
      return { success: false, error: 'Run already promoted' };
    }

    // 6. Execute promotion in transaction
    try {
      await this.policyRepository.activate(run.targetPolicyId!);

      // 7. Mark run as promoted
      await this.runRepository.update(run.id, {
        status: RunStatusEnum.PROMOTED,
        promotedAt: new Date(),
        promotedBy: 'system', // TODO: Get from auth context in Phase C
      });

      this.logger.log(`Promoted run ${run.id}: policy v${run.targetPolicyVersion} is now active`);

      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to promote run ${run.id}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cancel a running evaluation.
   * Sets status to CANCELLED, preserves cursor and counters for potential resume.
   *
   * @param runId - Run ID to cancel
   * @returns Success status
   */
  async cancelRun(runId: string): Promise<{ success: boolean; error?: string }> {
    const run = await this.runRepository.findById(runId);
    if (!run) {
      return { success: false, error: `Run ${runId} not found` };
    }

    // Only running runs can be cancelled
    if (!CANCELLABLE_RUN_STATUSES.includes(run.status as RunStatusType)) {
      return {
        success: false,
        error: `Run status is ${run.status}, can only cancel ${CANCELLABLE_RUN_STATUSES.join(', ')} runs`,
      };
    }

    await this.runRepository.update(runId, {
      status: RunStatusEnum.CANCELLED,
      finishedAt: new Date(),
    });

    this.logger.log(`Cancelled run ${runId}`);

    return { success: true };
  }

  /**
   * Resume a failed run from cursor.
   *
   * @param runId - Run ID to resume
   */
  async resumeRun(runId: string): Promise<{ runId: string; status: string }> {
    // TODO: Implement in Phase B
    throw new Error('Not implemented');
  }

  /**
   * List all runs with optional filtering.
   */
  async listRuns(options: {
    status?: string;
    policyId?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    // TODO: Implement in Phase B
    throw new Error('Not implemented');
  }

  /**
   * Helper: Count ready media items at snapshot cutoff.
   */
  private async countReadyMediaItems(snapshotCutoff: Date): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.mediaItems)
      .where(
        and(
          eq(schema.mediaItems.ingestionStatus, 'ready'),
          isNull(schema.mediaItems.deletedAt),
          lte(schema.mediaItems.updatedAt, snapshotCutoff),
        ),
      );

    return result[0]?.count || 0;
  }
}
