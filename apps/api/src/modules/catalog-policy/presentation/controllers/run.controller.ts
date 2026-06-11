/**
 * Run Controller
 *
 * Admin endpoints for evaluation run management.
 */

import { Controller, Post, Get, Param, Body, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

import { DEFAULT_PAGE_SIZE, DEFAULT_BATCH_SIZE } from '../../../../common/constants';
import { AdminJwtGuard } from '../../../auth/public';
import { RunMapper } from '../../application/mappers';
import { DiffService } from '../../application/services/diff.service';
import { PolicyActivationService } from '../../application/services/policy-activation.service';
import {
  PromoteOptionsDto,
  RunStatusDto,
  ActionResponseDto,
  DiffReportDto,
  RunsListDto,
  BackfillRequestDto,
  BackfillResponseDto,
} from '../dto';

@ApiTags('Admin: Policy')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('admin/catalog-policies/runs')
export class RunController {
  constructor(
    private readonly policyActivationService: PolicyActivationService,
    private readonly diffService: DiffService,
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
    const limit = limitStr ? parseInt(limitStr, 10) : DEFAULT_PAGE_SIZE;
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0;

    const runs = await this.policyActivationService.listRuns({ limit, offset });

    return { data: RunMapper.toListDtos(runs) };
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
    return RunMapper.toStatusDto(runStatus);
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
    const size = sampleSize ? parseInt(sampleSize, 10) : DEFAULT_BATCH_SIZE;
    const diffReport = await this.diffService.computeDiff(runId, size);
    return RunMapper.toDiffReportDto(diffReport);
  }

  /**
   * Backfill evaluations for a specific context.
   * Triggers re-evaluation for the specified context only using the active policy.
   *
   * @param body - Backfill request with context and options
   * @returns Backfill run ID for tracking progress
   */
  @Post('backfill')
  @ApiOperation({
    summary: 'Backfill evaluations for a specific context',
    description:
      'Triggers re-evaluation for the specified context only, using the currently active policy. ' +
      'Use this to populate missing evaluation data for a specific context without affecting other contexts.',
  })
  @ApiBody({
    type: BackfillRequestDto,
    description: 'Context to backfill and optional batch size',
  })
  @ApiResponse({
    status: 201,
    description: 'Backfill started',
    type: BackfillResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid context',
  })
  @ApiResponse({
    status: 404,
    description: 'No active policy found',
  })
  async backfillContext(@Body() body: BackfillRequestDto): Promise<BackfillResponseDto> {
    const result = await this.policyActivationService.backfillContext(body.context, {
      batchSize: body.batchSize,
    });

    return {
      runId: result.runId,
      status: result.status,
      context: result.context,
      message: `Backfill started for context=${result.context}. Use GET /admin/catalog-policies/runs/${result.runId} to track progress.`,
    };
  }
}
