/**
 * Policy Activation Service
 *
 * Implements two-phase policy activation flow (Prepare → Promote).
 * Ensures safe policy changes without showing mixed catalog states.
 *
 * Phase 1 (Prepare): Pre-compute all evaluations for new policy version
 * Phase 2 (Promote): Atomically switch active policy after verification
 */

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { Inject } from '@nestjs/common';

import { type Queue } from 'bullmq';
import { eq, and, isNull, lte, sql } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DATABASE_CONNECTION } from '../../../../database/database.module';
import * as schema from '../../../../database/schema';
import { CATALOG_POLICY_QUEUE, CATALOG_POLICY_JOBS } from '../../catalog-policy.constants';
import {
  RunStatus as RunStatusEnum,
  type RunStatusType,
  CANCELLABLE_RUN_STATUSES,
  BlockingReasonCode,
  type BlockingReasonType,
} from '../../domain/constants/evaluation.constants';
import {
  type ICatalogEvaluationRunRepository,
  CATALOG_EVALUATION_RUN_REPOSITORY,
} from '../../infrastructure/repositories/catalog-evaluation-run.repository';
import {
  type ICatalogPolicyRepository,
  CATALOG_POLICY_REPOSITORY,
} from '../../infrastructure/repositories/catalog-policy.repository';

import { CatalogPolicyService } from './catalog-policy.service';
import { RunAggregationService } from './run-aggregation.service';

// Constants
const DEFAULT_BATCH_SIZE = 500;
const PERCENT_MULTIPLIER = 100;

export interface PrepareOptions {
  batchSize?: number; // default: 500
  concurrency?: number; // default: 10
}

export interface PromoteOptions {
  coverageThreshold?: number; // default: 1.0 (100%)
  maxErrors?: number; // default: 0
}

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
  blockingReasons: BlockingReasonType[];
  coverage: number;
}

export interface RunListItem {
  id: string;
  policyId: string;
  policyName: string;
  status: RunStatusType;
  progress: {
    processed: number;
    total: number;
    eligible: number;
    ineligible: number;
    pending: number;
    errors: number;
  };
  startedAt: Date;
  finishedAt?: Date;
  readyToPromote: boolean;
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
    private readonly aggregationService: RunAggregationService,
    private readonly catalogPolicyService: CatalogPolicyService,
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

    // 4. Calculate totalReadySnapshot, snapshotCutoff, and create run in transaction
    // This prevents race condition where active policy changes between baseline capture and run creation
    const snapshotCutoff = new Date();

    const run = await this.db.transaction(async (tx) => {
      // Get current active policy version for baseline (for diff calculation)
      const activePolicyResult = await tx
        .select({ version: schema.catalogPolicies.version })
        .from(schema.catalogPolicies)
        .where(eq(schema.catalogPolicies.isActive, true))
        .limit(1);

      const baselinePolicyVersion = activePolicyResult[0]?.version ?? null;

      // Calculate totalReadySnapshot
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

      this.logger.log(
        `Preparing policy v${policy.version}: ${totalReadySnapshot} items in snapshot`,
      );

      // Create run with status=RUNNING
      const runResult = await this.runRepository.create({
        targetPolicyId: policyId,
        targetPolicyVersion: policy.version,
        baselinePolicyVersion,
        totalReadySnapshot,
        snapshotCutoff,
      });

      return runResult;
    });

    // 5. Queue RE_EVALUATE_ALL job with retries
    await this.catalogQueue.add(
      CATALOG_POLICY_JOBS.RE_EVALUATE_ALL,
      {
        runId: run.id,
        policyVersion: policy.version,
        batchSize: options?.batchSize || DEFAULT_BATCH_SIZE,
      },
      {
        jobId: `reeval_${policy.version}_${run.id}`,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s, 10s, 20s, 40s, 80s
        },
        removeOnFail: false, // Keep failed jobs for debugging
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
   * For running runs, returns live aggregated counters from evaluations table.
   * For completed runs, returns cached counters from run record.
   *
   * @param runId - Run ID to check
   * @returns Run status with computed flags
   */
  async getRunStatus(runId: string): Promise<RunStatus> {
    const run = await this.runRepository.findById(runId);
    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    // For running runs, get live counters from evaluations table (source of truth)
    // For completed runs, use cached counters
    let counters = {
      processed: run.processed,
      eligible: run.eligible,
      ineligible: run.ineligible,
      pending: run.pending,
      errors: run.errors,
    };

    if (run.status === RunStatusEnum.RUNNING) {
      // Live aggregate for running runs
      const liveCounters = await this.aggregationService.aggregateCounters(runId);
      counters = liveCounters;
    }

    // Calculate coverage
    const coverage = run.totalReadySnapshot > 0 ? counters.processed / run.totalReadySnapshot : 0;

    // Calculate readyToPromote and blockingReasons
    const blockingReasons: BlockingReasonType[] = [];

    if (run.status !== RunStatusEnum.PREPARED) {
      blockingReasons.push(BlockingReasonCode.RUN_NOT_SUCCESS);
    }

    if (coverage < 1.0) {
      blockingReasons.push(BlockingReasonCode.COVERAGE_NOT_MET);
    }

    if (counters.errors > 0) {
      blockingReasons.push(BlockingReasonCode.ERRORS_EXCEEDED);
    }

    if (run.promotedAt !== null) {
      blockingReasons.push(BlockingReasonCode.ALREADY_PROMOTED);
    }

    const readyToPromote = blockingReasons.length === 0;

    return {
      id: run.id,
      targetPolicyId: run.targetPolicyId!,
      targetPolicyVersion: run.targetPolicyVersion!,
      status: run.status,
      totalReadySnapshot: run.totalReadySnapshot,
      processed: counters.processed,
      eligible: counters.eligible,
      ineligible: counters.ineligible,
      pending: counters.pending,
      errors: counters.errors,
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
   * Verifies run is PREPARED and meets thresholds, then atomically switches active policy.
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

    // 2. Verify status=PREPARED
    if (run.status !== RunStatusEnum.PREPARED) {
      return {
        success: false,
        error: `Run status is ${run.status}, expected ${RunStatusEnum.PREPARED}`,
      };
    }

    // 3. Check coverage threshold
    const coverage = run.totalReadySnapshot > 0 ? run.processed / run.totalReadySnapshot : 0;

    if (coverage < coverageThreshold) {
      return {
        success: false,
        error: `Coverage ${(coverage * PERCENT_MULTIPLIER).toFixed(1)}% is below threshold ${(coverageThreshold * PERCENT_MULTIPLIER).toFixed(1)}%`,
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
        promotedBy: 'system', // Admin user tracking not yet implemented
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
   * List all evaluation runs with policy names.
   *
   * @param options - Pagination options
   * @returns List of runs with policy metadata
   */
  async listRuns(options?: { limit?: number; offset?: number }): Promise<RunListItem[]> {
    const runs = await this.runRepository.findAll(options);
    const policies = await this.catalogPolicyService.listAll();
    const policyMap = new Map(policies.map((p) => [p.id, p]));

    return runs.map((run) => {
      const policy = run.targetPolicyId ? policyMap.get(run.targetPolicyId) : null;
      const isPrepared = run.status === RunStatusEnum.PREPARED;

      return {
        id: run.id,
        policyId: run.targetPolicyId || '',
        policyName: policy ? `Policy v${policy.version}` : `Policy v${run.policyVersion}`,
        status: run.status,
        progress: {
          processed: run.processed,
          total: run.totalReadySnapshot,
          eligible: run.eligible,
          ineligible: run.ineligible,
          pending: run.pending,
          errors: run.errors,
        },
        startedAt: run.startedAt,
        finishedAt: run.finishedAt || undefined,
        readyToPromote: isPrepared && run.errors === 0,
      };
    });
  }
}
