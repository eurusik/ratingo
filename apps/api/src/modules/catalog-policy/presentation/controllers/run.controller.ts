/**
 * Run Controller
 *
 * Admin endpoints for evaluation run management.
 */

import { Controller, Post, Get, Param, Body, Query, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { PolicyActivationService } from '../../application/services/policy-activation.service';
import { DiffService } from '../../application/services/diff.service';
import {
  CATALOG_POLICY_REPOSITORY,
  ICatalogPolicyRepository,
} from '../../infrastructure/repositories/catalog-policy.repository';
import {
  CATALOG_EVALUATION_RUN_REPOSITORY,
  ICatalogEvaluationRunRepository,
} from '../../infrastructure/repositories/catalog-evaluation-run.repository';
import { RunStatus } from '../../domain/constants/evaluation.constants';
import {
  PromoteOptionsDto,
  RunStatusDto,
  ActionResponseDto,
  DiffReportDto,
  RunsListDto,
  EvaluationRunDto,
} from '../dto';

@ApiTags('Admin - Policy Activation')
@Controller('admin/catalog-policies/runs')
export class RunController {
  constructor(
    private readonly policyActivationService: PolicyActivationService,
    private readonly diffService: DiffService,
    @Inject(CATALOG_POLICY_REPOSITORY)
    private readonly policyRepository: ICatalogPolicyRepository,
    @Inject(CATALOG_EVALUATION_RUN_REPOSITORY)
    private readonly runRepository: ICatalogEvaluationRunRepository,
  ) {}

  /**
   * Gets list of all evaluation runs.
   *
   * @param limitStr - Number of runs to return
   * @param offsetStr - Offset for pagination
   * @returns List of evaluation runs
   */
  @Get()
  @ApiOperation({
    summary: 'Get list of evaluation runs',
    description: 'Returns list of all evaluation runs with their status and progress.',
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of runs to return (default: 20)',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'offset',
    description: 'Offset for pagination (default: 0)',
    required: false,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'List of evaluation runs',
    type: RunsListDto,
  })
  async getRuns(
    @Query('limit') limitStr?: string,
    @Query('offset') offsetStr?: string,
  ): Promise<RunsListDto> {
    const limit = limitStr ? parseInt(limitStr, 10) : 20;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

    const runs = await this.runRepository.findAll({ limit, offset });

    // Get all policies to map policy names
    const policies = await this.policyRepository.findAll();
    const policyMap = new Map(policies.map((p) => [p.id, p]));

    const data: EvaluationRunDto[] = runs.map((run) => {
      const policy = run.targetPolicyId ? policyMap.get(run.targetPolicyId) : null;
      const isPrepared = run.status === RunStatus.PREPARED;

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

    return { data };
  }

  /**
   * Gets status and progress of an evaluation run.
   *
   * @param runId - Run ID to check
   * @returns Run status with progress and counters
   */
  @Get(':runId')
  @ApiOperation({
    summary: 'Get run status and progress',
    description:
      'Returns detailed status of an evaluation run including progress, counters, and readyToPromote flag.',
  })
  @ApiParam({
    name: 'runId',
    description: 'Run ID to check',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Run status and progress',
    type: RunStatusDto,
  })
  async getRunStatus(@Param('runId') runId: string): Promise<RunStatusDto> {
    const runStatus = await this.policyActivationService.getRunStatus(runId);

    return {
      id: runStatus.id,
      targetPolicyId: runStatus.targetPolicyId,
      targetPolicyVersion: runStatus.targetPolicyVersion,
      status: runStatus.status,
      progress: {
        processed: runStatus.processed,
        total: runStatus.totalReadySnapshot,
        eligible: runStatus.eligible,
        ineligible: runStatus.ineligible,
        pending: runStatus.pending,
        errors: runStatus.errors,
      },
      startedAt: runStatus.startedAt,
      finishedAt: runStatus.finishedAt,
      promotedAt: runStatus.promotedAt,
      promotedBy: runStatus.promotedBy,
      readyToPromote: runStatus.readyToPromote,
      blockingReasons: runStatus.blockingReasons,
      coverage: runStatus.coverage,
      errorSample: [], // Error sample not yet exposed via RunStatus interface
    };
  }

  /**
   * Promotes run by activating the policy.
   *
   * @param runId - Run ID to promote
   * @param options - Coverage and error thresholds
   * @returns Promotion result
   */
  @Post(':runId/promote')
  @ApiOperation({
    summary: 'Promote run to activate policy',
    description:
      'Verifies run is successful and meets thresholds, then atomically activates the policy. ' +
      'This makes the new policy version active for the public catalog.',
  })
  @ApiParam({
    name: 'runId',
    description: 'Run ID to promote',
    type: String,
  })
  @ApiBody({
    type: PromoteOptionsDto,
    required: false,
    description: 'Optional coverage and error thresholds (defaults: 100% coverage, 0 errors)',
  })
  @ApiResponse({
    status: 201,
    description: 'Promotion result',
    type: ActionResponseDto,
  })
  async promoteRun(
    @Param('runId') runId: string,
    @Body() options?: PromoteOptionsDto,
  ): Promise<ActionResponseDto> {
    const result = await this.policyActivationService.promoteRun(runId, options);

    if (result.success) {
      return {
        success: true,
        message: 'Policy activated successfully',
      };
    }

    return result;
  }

  /**
   * Cancels a running evaluation.
   *
   * @param runId - Run ID to cancel
   * @returns Cancellation result
   */
  @Post(':runId/cancel')
  @ApiOperation({
    summary: 'Cancel running evaluation',
    description:
      'Cancels a running evaluation. Item jobs already in queue will be skipped. ' +
      'Preserves cursor and counters for potential resume.',
  })
  @ApiParam({
    name: 'runId',
    description: 'Run ID to cancel',
    type: String,
  })
  @ApiResponse({
    status: 201,
    description: 'Cancellation result',
    type: ActionResponseDto,
  })
  async cancelRun(@Param('runId') runId: string): Promise<ActionResponseDto> {
    const result = await this.policyActivationService.cancelRun(runId);

    if (result.success) {
      return {
        success: true,
        message: 'Run cancelled successfully',
      };
    }

    return result;
  }

  /**
   * Gets diff report showing catalog changes.
   *
   * @param runId - Run ID to compute diff for
   * @param sampleSize - Number of sample items to return
   * @returns Diff report with regressions and improvements
   */
  @Get(':runId/diff')
  @ApiOperation({
    summary: 'Get diff report',
    description:
      'Computes differences between current active policy and the prepared run. ' +
      'Shows regressions (items leaving catalog) and improvements (items entering catalog).',
  })
  @ApiParam({
    name: 'runId',
    description: 'Run ID to compute diff for',
    type: String,
  })
  @ApiQuery({
    name: 'sampleSize',
    description: 'Number of sample items to return (default: 50)',
    required: false,
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Diff report',
    type: DiffReportDto,
  })
  async getDiff(
    @Param('runId') runId: string,
    @Query('sampleSize') sampleSize?: string,
  ): Promise<DiffReportDto> {
    const size = sampleSize ? parseInt(sampleSize, 10) : 50;
    const diffReport = await this.diffService.computeDiff(runId, size);

    return {
      runId: diffReport.runId,
      targetPolicyVersion: diffReport.targetPolicyVersion,
      currentPolicyVersion: diffReport.currentPolicyVersion,
      counts: {
        regressions: diffReport.counts.regressions,
        improvements: diffReport.counts.improvements,
        netChange: diffReport.counts.improvements - diffReport.counts.regressions,
      },
      topRegressions: diffReport.topRegressions.map((item) => ({
        mediaItemId: item.mediaItemId,
        title: item.title || 'Unknown',
        reason: `Status change: ${item.oldStatus} → ${item.newStatus}`,
      })),
      topImprovements: diffReport.topImprovements.map((item) => ({
        mediaItemId: item.mediaItemId,
        title: item.title || 'Unknown',
        reason: `Status change: ${item.oldStatus} → ${item.newStatus}`,
      })),
      reasonBreakdown: diffReport.reasonBreakdown,
    };
  }
}
