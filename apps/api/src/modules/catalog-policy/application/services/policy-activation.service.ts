/**
 * Policy Activation Service
 *
 * Implements two-phase policy activation flow (Prepare → Promote).
 */

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Inject } from '@nestjs/common';

import { type Queue } from 'bullmq';

import { CATALOG_POLICY_QUEUE, CATALOG_POLICY_JOBS } from '../../catalog-policy.constants';
import {
  RunStatus as RunStatusEnum,
  type RunStatusType,
  CANCELLABLE_RUN_STATUSES,
  BlockingReasonCode,
  type BlockingReasonType,
  ACTIVE_EVALUATION_CONTEXTS,
  type EvaluationContextType,
} from '../../domain/constants/evaluation.constants';
import {
  PolicyNotFoundError,
  RunNotFoundError,
  PolicyAlreadyActiveError,
  RunAlreadyInProgressError,
  InvalidContextError,
  NoActivePolicyError,
} from '../../domain/errors';
import {
  CATALOG_POLICY_REPOSITORY,
  type ICatalogPolicyRepository,
  CATALOG_EVALUATION_RUN_REPOSITORY,
  type ICatalogEvaluationRunRepository,
  POLICY_ACTIVATION_REPOSITORY,
  type IPolicyActivationRepository,
} from '../../domain/repositories';

import { CatalogPolicyService } from './catalog-policy.service';
import { RunAggregationService } from './run-aggregation.service';

// Constants
const DEFAULT_BATCH_SIZE = 500;
const BACKFILL_RUN_PREFIX = 'backfill';
const PERCENT_MULTIPLIER = 100;

// Job configuration
const JOB_MAX_ATTEMPTS = 5;
const JOB_BACKOFF_DELAY_MS = 5000;

const RE_EVALUATE_JOB_OPTIONS = {
  attempts: JOB_MAX_ATTEMPTS,
  backoff: {
    type: 'exponential' as const,
    delay: JOB_BACKOFF_DELAY_MS,
  },
  removeOnFail: false,
};

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
  policyVersion: number;
  status: RunStatusType;
  progress: {
    processed: number;
    total: number;
    eligible: number;
    ineligible: number;
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
    @Inject(CATALOG_POLICY_REPOSITORY)
    private readonly policyRepository: ICatalogPolicyRepository,
    @Inject(CATALOG_EVALUATION_RUN_REPOSITORY)
    private readonly runRepository: ICatalogEvaluationRunRepository,
    @Inject(POLICY_ACTIVATION_REPOSITORY)
    private readonly policyActivationRepository: IPolicyActivationRepository,
    @InjectQueue(CATALOG_POLICY_QUEUE)
    private readonly catalogQueue: Queue,
    private readonly aggregationService: RunAggregationService,
    private readonly catalogPolicyService: CatalogPolicyService,
  ) {}

  async preparePolicy(
    policyId: string,
    options?: PrepareOptions,
  ): Promise<{ runId: string; status: string }> {
    const policy = await this.policyRepository.findById(policyId);
    if (!policy) {
      throw new PolicyNotFoundError(policyId);
    }

    if (policy.isActive) {
      throw new PolicyAlreadyActiveError(policyId);
    }

    const existingRuns = await this.runRepository.findByPolicyId(policyId);
    const runningRun = existingRuns.find((run) => run.status === RunStatusEnum.RUNNING);
    if (runningRun) {
      throw new RunAlreadyInProgressError(policyId, runningRun.id);
    }

    // Create run with snapshot atomically (prevents race condition)
    const snapshotResult = await this.policyActivationRepository.createRunWithSnapshot({
      targetPolicyId: policyId,
      targetPolicyVersion: policy.version,
    });

    this.logger.log(
      `Preparing policy v${policy.version}: ${snapshotResult.totalReadySnapshot} items in snapshot`,
    );

    const run = { id: snapshotResult.runId };

    // Fan-out: Queue RE_EVALUATE_ALL job for each active context
    for (const context of ACTIVE_EVALUATION_CONTEXTS) {
      await this.queueReEvaluateJob({
        runId: run.id,
        policyVersion: policy.version,
        context,
        batchSize: options?.batchSize || DEFAULT_BATCH_SIZE,
        jobIdPrefix: 'reeval',
      });
    }

    this.logger.log(
      `Created run ${run.id} for policy v${policy.version} and queued ${ACTIVE_EVALUATION_CONTEXTS.length} RE_EVALUATE_ALL jobs (fan-out)`,
    );

    return {
      runId: run.id,
      status: RunStatusEnum.RUNNING,
    };
  }

  async getRunStatus(runId: string): Promise<RunStatus> {
    const run = await this.runRepository.findById(runId);
    if (!run) {
      throw new RunNotFoundError(runId);
    }

    // For running runs, get live counters from evaluations table (source of truth)
    // For completed runs, use cached counters
    const counters =
      run.status === RunStatusEnum.RUNNING
        ? await this.aggregationService.aggregateCounters(runId)
        : {
            processed: run.processed,
            eligible: run.eligible,
            ineligible: run.ineligible,
            errors: run.errors,
          };

    const coverage = this.calculateCoverage(counters.processed, run.totalReadySnapshot);

    const blockingReasons = this.calculateBlockingReasons({
      status: run.status,
      coverage,
      errors: counters.errors,
      promotedAt: run.promotedAt,
    });
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

  async promoteRun(
    runId: string,
    options?: PromoteOptions,
  ): Promise<{ success: boolean; error?: string }> {
    const coverageThreshold = options?.coverageThreshold ?? 1.0;
    const maxErrors = options?.maxErrors ?? 0;

    const run = await this.runRepository.findById(runId);
    if (!run) {
      return { success: false, error: `Run ${runId} not found` };
    }

    if (run.status !== RunStatusEnum.PREPARED) {
      return {
        success: false,
        error: `Run status is ${run.status}, expected ${RunStatusEnum.PREPARED}`,
      };
    }

    const coverage = this.calculateCoverage(run.processed, run.totalReadySnapshot);
    if (coverage < coverageThreshold) {
      return {
        success: false,
        error: `Coverage ${(coverage * PERCENT_MULTIPLIER).toFixed(1)}% is below threshold ${(coverageThreshold * PERCENT_MULTIPLIER).toFixed(1)}%`,
      };
    }

    if (run.errors > maxErrors) {
      return {
        success: false,
        error: `Errors ${run.errors} exceed threshold ${maxErrors}`,
      };
    }

    if (run.promotedAt !== null) {
      return { success: false, error: 'Run already promoted' };
    }

    if (!run.targetPolicyId) {
      return { success: false, error: 'Run has no target policy' };
    }

    try {
      // Execute promotion atomically to prevent race condition
      await this.policyActivationRepository.promoteRun({
        runId: run.id,
        targetPolicyId: run.targetPolicyId!,
        newStatus: RunStatusEnum.PROMOTED,
        promotedBy: 'system',
      });

      this.logger.log(`Promoted run ${run.id}: policy v${run.targetPolicyVersion} is now active`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to promote run ${run.id}`, error);
      return { success: false, error: (error as Error).message };
    }
  }

  async cancelRun(runId: string): Promise<{ success: boolean; error?: string }> {
    const run = await this.runRepository.findById(runId);
    if (!run) {
      return { success: false, error: `Run ${runId} not found` };
    }

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

  async listRuns(options?: { limit?: number; offset?: number }): Promise<RunListItem[]> {
    const runs = await this.runRepository.findAll(options);
    const policies = await this.catalogPolicyService.listAll();
    const policyMap = new Map(policies.map((p) => [p.id, p]));

    return runs.map((run) => {
      const policy = run.targetPolicyId ? policyMap.get(run.targetPolicyId) : null;
      const isPrepared = run.status === RunStatusEnum.PREPARED;
      const version = policy?.version ?? run.policyVersion ?? 0;

      return {
        id: run.id,
        policyId: run.targetPolicyId || '',
        policyName: policy ? `Policy v${policy.version}` : `Policy v${run.policyVersion}`,
        policyVersion: version,
        status: run.status,
        progress: {
          processed: run.processed,
          total: run.totalReadySnapshot,
          eligible: run.eligible,
          ineligible: run.ineligible,
          errors: run.errors,
        },
        startedAt: run.startedAt,
        finishedAt: run.finishedAt || undefined,
        readyToPromote: isPrepared && run.errors === 0,
      };
    });
  }

  async backfillContext(
    context: EvaluationContextType,
    options?: { batchSize?: number },
  ): Promise<{ runId: string; status: string; context: EvaluationContextType }> {
    if (!ACTIVE_EVALUATION_CONTEXTS.includes(context)) {
      throw new InvalidContextError(context, [...ACTIVE_EVALUATION_CONTEXTS]);
    }

    const activePolicy = await this.policyRepository.findActive();
    if (!activePolicy) {
      throw new NoActivePolicyError();
    }

    const snapshotCutoff = new Date();
    const totalReadySnapshot =
      await this.policyActivationRepository.countReadyMediaItems(snapshotCutoff);

    this.logger.log(
      `Backfill for context=${context}: ${totalReadySnapshot} items in snapshot, policy v${activePolicy.version}`,
    );

    const run = await this.runRepository.create({
      targetPolicyId: activePolicy.id,
      targetPolicyVersion: activePolicy.version,
      baselinePolicyVersion: activePolicy.version,
      totalReadySnapshot,
      snapshotCutoff,
    });

    await this.queueReEvaluateJob({
      runId: run.id,
      policyVersion: activePolicy.version,
      context,
      batchSize: options?.batchSize || DEFAULT_BATCH_SIZE,
      jobIdPrefix: BACKFILL_RUN_PREFIX,
    });

    this.logger.log(
      `Created backfill run ${run.id} for context=${context}, policy v${activePolicy.version}`,
    );

    return {
      runId: run.id,
      status: RunStatusEnum.RUNNING,
      context,
    };
  }

  private calculateCoverage(processed: number, total: number): number {
    return total > 0 ? processed / total : 0;
  }

  private calculateBlockingReasons(params: {
    status: RunStatusType;
    coverage: number;
    errors: number;
    promotedAt: Date | null;
  }): BlockingReasonType[] {
    const reasons: BlockingReasonType[] = [];

    if (params.status !== RunStatusEnum.PREPARED) {
      reasons.push(BlockingReasonCode.RUN_NOT_SUCCESS);
    }
    if (params.coverage < 1.0) {
      reasons.push(BlockingReasonCode.COVERAGE_NOT_MET);
    }
    if (params.errors > 0) {
      reasons.push(BlockingReasonCode.ERRORS_EXCEEDED);
    }
    if (params.promotedAt !== null) {
      reasons.push(BlockingReasonCode.ALREADY_PROMOTED);
    }

    return reasons;
  }

  private async queueReEvaluateJob(params: {
    runId: string;
    policyVersion: number;
    context: EvaluationContextType;
    batchSize: number;
    jobIdPrefix: string;
  }): Promise<void> {
    const { runId, policyVersion, context, batchSize, jobIdPrefix } = params;

    await this.catalogQueue.add(
      CATALOG_POLICY_JOBS.RE_EVALUATE_ALL,
      { runId, policyVersion, context, batchSize },
      {
        jobId: `${jobIdPrefix}_${policyVersion}_${runId}_${context}`,
        ...RE_EVALUATE_JOB_OPTIONS,
      },
    );

    this.logger.log(
      `Dispatched RE_EVALUATE_ALL for context=${context}, runId=${runId}, policyVersion=${policyVersion}`,
    );
  }
}
