/**
 * Policy Activation Controller
 *
 * Admin API endpoints for managing policy activation flow (Prepare → Promote).
 * Provides endpoints for preparing policies, checking run status, and promoting runs.
 */

import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { PolicyActivationService } from '../../application/services/policy-activation.service';
import { DiffService } from '../../application/services/diff.service';
import {
  PrepareOptionsDto,
  PromoteOptionsDto,
  PrepareResponseDto,
  RunStatusDto,
  ActionResponseDto,
  DiffReportDto,
} from '../dto/policy-activation.dto';

@ApiTags('Admin - Policy Activation')
@Controller('admin/catalog-policies')
export class PolicyActivationController {
  constructor(
    private readonly policyActivationService: PolicyActivationService,
    private readonly diffService: DiffService,
  ) {}

  /**
   * POST /admin/catalog-policies/:id/prepare
   * Prepares a policy for activation by pre-computing all evaluations.
   */
  @Post(':id/prepare')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Prepare policy for activation',
    description:
      'Creates an evaluation run and starts background job to pre-compute evaluations for all media items. ' +
      'Returns immediately with run ID for tracking progress.',
  })
  @ApiParam({
    name: 'id',
    description: 'Policy ID to prepare',
    type: String,
  })
  @ApiBody({
    type: PrepareOptionsDto,
    required: false,
    description: 'Optional batch size and concurrency settings',
  })
  @ApiResponse({
    status: 202,
    description: 'Policy preparation started',
    type: PrepareResponseDto,
  })
  async preparePolicy(
    @Param('id') policyId: string,
    @Body() options?: PrepareOptionsDto,
  ): Promise<PrepareResponseDto> {
    const result = await this.policyActivationService.preparePolicy(policyId, options);

    return {
      runId: result.runId,
      status: result.status,
      message: `Policy preparation started. Use GET /admin/catalog-policy-runs/${result.runId} to track progress.`,
    };
  }

  /**
   * GET /admin/catalog-policy-runs/:runId
   * Gets the status and progress of an evaluation run.
   */
  @Get('/runs/:runId')
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
      errorSample: [], // TODO: Map from runStatus.errorSample when available
    };
  }

  /**
   * POST /admin/catalog-policy-runs/:runId/promote
   * Promotes a successful run by activating the policy.
   */
  @Post('/runs/:runId/promote')
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
   * POST /admin/catalog-policy-runs/:runId/cancel
   * Cancels a running evaluation.
   */
  @Post('/runs/:runId/cancel')
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
   * GET /admin/catalog-policy-runs/:runId/diff
   * Gets diff report showing what will change when policy is promoted.
   */
  @Get('/runs/:runId/diff')
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
    };
  }
}
// TODO: Add these endpoints when needed

/**
 * GET /admin/catalog-policies
 * Gets list of all policies.
 */
// @Get()
// @ApiOperation({
//   summary: 'Get list of policies',
//   description: 'Returns list of all catalog policies with their status and metadata.',
// })
// @ApiResponse({
//   status: 200,
//   description: 'List of policies',
//   type: PoliciesListDto,
// })
// async getPolicies(): Promise<PoliciesListDto> {
//   // TODO: Implement
//   throw new Error('Not implemented');
// }

/**
 * GET /admin/catalog-policy-runs
 * Gets list of all evaluation runs.
 */
// @Get('/runs')
// @ApiOperation({
//   summary: 'Get list of evaluation runs',
//   description: 'Returns list of all evaluation runs with their status and progress.',
// })
// @ApiResponse({
//   status: 200,
//   description: 'List of evaluation runs',
//   type: RunsListDto,
// })
// async getRuns(): Promise<RunsListDto> {
//   // TODO: Implement
//   throw new Error('Not implemented');
// }
