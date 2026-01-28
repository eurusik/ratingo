/**
 * Diff Service
 *
 * Computes differences between current active policy and a prepared policy run.
 * Shows what will change in the catalog when the new policy is promoted.
 */

import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';

import { DIFFABLE_RUN_STATUSES } from '../../domain/constants/evaluation.constants';
import {
  DIFF_REPOSITORY,
  type IDiffRepository,
  CATALOG_EVALUATION_RUN_REPOSITORY,
  type ICatalogEvaluationRunRepository,
  CATALOG_POLICY_REPOSITORY,
  type ICatalogPolicyRepository,
} from '../../domain/repositories';
import { DEFAULT_DIFF_SAMPLE_SIZE, type DiffReport } from '../../domain/types/diff.types';

// Re-export types and utils for backward compatibility
export { isDiffRegression, isDiffImprovement } from '../../domain/utils/diff.utils';
export {
  type DiffCounts,
  type DiffSample,
  type ReasonBreakdown,
  type DiffReport,
} from '../../domain/types/diff.types';

@Injectable()
export class DiffService {
  constructor(
    @Inject(DIFF_REPOSITORY)
    private readonly diffRepository: IDiffRepository,
    @Inject(CATALOG_EVALUATION_RUN_REPOSITORY)
    private readonly runRepository: ICatalogEvaluationRunRepository,
    @Inject(CATALOG_POLICY_REPOSITORY)
    private readonly policyRepository: ICatalogPolicyRepository,
  ) {}

  /**
   * Computes diff between baseline policy and the prepared run.
   * Uses baselinePolicyVersion stored in run for consistent historical comparison.
   */
  async computeDiff(
    runId: string,
    sampleSize: number = DEFAULT_DIFF_SAMPLE_SIZE,
  ): Promise<DiffReport> {
    const run = await this.runRepository.findById(runId);
    if (!run) {
      throw new NotFoundException(`Run ${runId} not found`);
    }

    if (!DIFFABLE_RUN_STATUSES.includes(run.status as (typeof DIFFABLE_RUN_STATUSES)[number])) {
      throw new BadRequestException(
        `Run status is ${run.status}, diff only available for ${DIFFABLE_RUN_STATUSES.join(' or ')} runs`,
      );
    }

    if (run.targetPolicyVersion === null) {
      throw new BadRequestException('Run has no target policy version');
    }

    // Fallback to current active policy for legacy runs without baseline
    let currentPolicyVersion = run.baselinePolicyVersion ?? null;
    if (currentPolicyVersion === null) {
      const activePolicy = await this.policyRepository.findActive();
      currentPolicyVersion = activePolicy?.version ?? null;
    }

    const [counts, topRegressions, topImprovements, reasonBreakdown] = await Promise.all([
      this.diffRepository.computeDiffCounts(run.targetPolicyVersion, currentPolicyVersion),
      this.diffRepository.getDiffSamples(
        run.targetPolicyVersion,
        currentPolicyVersion,
        'regression',
        sampleSize,
      ),
      this.diffRepository.getDiffSamples(
        run.targetPolicyVersion,
        currentPolicyVersion,
        'improvement',
        sampleSize,
      ),
      this.diffRepository.computeReasonBreakdown(run.targetPolicyVersion, currentPolicyVersion),
    ]);

    return {
      runId,
      targetPolicyVersion: run.targetPolicyVersion,
      currentPolicyVersion,
      counts,
      topRegressions,
      topImprovements,
      reasonBreakdown,
    };
  }
}
