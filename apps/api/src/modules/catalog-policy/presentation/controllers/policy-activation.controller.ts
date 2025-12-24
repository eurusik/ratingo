/**
 * Policy Activation Controller
 *
 * Admin API endpoints for managing policy activation flow (Prepare → Promote).
 * Provides endpoints for preparing policies, checking run status, and promoting runs.
 */

import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Query,
  Inject,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { PolicyActivationService } from '../../application/services/policy-activation.service';
import { CatalogPolicyService } from '../../application/services/catalog-policy.service';
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
  PrepareOptionsDto,
  PromoteOptionsDto,
  PrepareResponseDto,
  RunStatusDto,
  ActionResponseDto,
  DiffReportDto,
  PoliciesListDto,
  RunsListDto,
  PolicyDto,
  EvaluationRunDto,
  CreatePolicyDto,
  CreatePolicyResponseDto,
} from '../dto/policy-activation.dto';
import { DryRunRequestDto, DryRunResponseDto } from '../dto/dry-run.dto';
import { DryRunService } from '../../application/services/dry-run.service';
import { validatePolicyOrThrow } from '../../domain/validation/policy.schema';

@ApiTags('Admin - Policy Activation')
@Controller('admin/catalog-policies')
export class PolicyActivationController {
  constructor(
    private readonly policyActivationService: PolicyActivationService,
    private readonly catalogPolicyService: CatalogPolicyService,
    private readonly diffService: DiffService,
    private readonly dryRunService: DryRunService,
    @Inject(CATALOG_POLICY_REPOSITORY)
    private readonly policyRepository: ICatalogPolicyRepository,
    @Inject(CATALOG_EVALUATION_RUN_REPOSITORY)
    private readonly runRepository: ICatalogEvaluationRunRepository,
  ) {}

  /**
   * GET /admin/catalog-policies
   * Gets list of all policies.
   */
  @Get()
  @ApiOperation({
    summary: 'Get list of policies',
    description: 'Returns list of all catalog policies with their status and metadata.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of policies',
    type: PoliciesListDto,
  })
  async getPolicies(): Promise<PoliciesListDto> {
    const policies = await this.policyRepository.findAll();

    const data: PolicyDto[] = policies.map((p) => ({
      id: p.id,
      name: `Policy v${p.version}`,
      version: String(p.version),
      status: p.isActive ? 'active' : 'inactive',
      description: p.policy.eligibilityMode
        ? `${p.policy.eligibilityMode} mode, ${p.policy.allowedCountries?.length || 0} allowed countries`
        : undefined,
      updatedAt: p.activatedAt || p.createdAt,
    }));

    return { data };
  }

  /**
   * POST /admin/catalog-policies
   * Creates a new policy draft.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create new policy',
    description:
      'Creates a new policy draft with auto-incremented version. ' +
      'The policy is NOT activated automatically. Use POST /:id/prepare to start evaluation.',
  })
  @ApiBody({
    type: CreatePolicyDto,
    description: 'Policy configuration',
  })
  @ApiResponse({
    status: 201,
    description: 'Policy created',
    type: CreatePolicyResponseDto,
  })
  async createPolicy(@Body() dto: CreatePolicyDto): Promise<CreatePolicyResponseDto> {
    const policy = await this.catalogPolicyService.createDraft(dto);

    return {
      id: policy.id,
      version: policy.version,
      message: `Policy v${policy.version} created successfully. Use POST /admin/catalog-policies/${policy.id}/prepare to start evaluation.`,
    };
  }

  /**
   * GET /admin/catalog-policies/runs
   * Gets list of all evaluation runs.
   */
  @Get('/runs')
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
      const isRunning = run.status === RunStatus.RUNNING;
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

  /**
   * POST /admin/catalog-policies/dry-run
   * Executes a dry-run evaluation against a proposed policy.
   */
  @Post('/dry-run')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Execute dry-run evaluation',
    description:
      'Evaluates media items against a proposed policy WITHOUT persisting results. ' +
      'Supports multiple selection modes: sample (random), top (by popularity), byType, byCountry. ' +
      'Limits: max 10000 items, 60s timeout.',
  })
  @ApiBody({
    type: DryRunRequestDto,
    description: 'Proposed policy and dry-run options',
  })
  @ApiResponse({
    status: 200,
    description: 'Dry-run results',
    type: DryRunResponseDto,
  })
  async executeDryRun(@Body() dto: DryRunRequestDto): Promise<DryRunResponseDto> {
    // Validate and normalize policy
    const normalizedPolicy = validatePolicyOrThrow({
      allowedCountries: dto.policy.allowedCountries,
      blockedCountries: dto.policy.blockedCountries,
      blockedCountryMode: dto.policy.blockedCountryMode || 'ANY',
      allowedLanguages: dto.policy.allowedLanguages,
      blockedLanguages: dto.policy.blockedLanguages,
      globalProviders: dto.policy.globalProviders || [],
      breakoutRules: dto.policy.breakoutRules || [],
      eligibilityMode: dto.policy.eligibilityMode || 'STRICT',
      homepage: dto.policy.homepage || { minRelevanceScore: 50 },
    });

    // Execute dry-run
    const result = await this.dryRunService.execute(normalizedPolicy, {
      mode: dto.options.mode,
      limit: dto.options.limit,
      mediaType: dto.options.mediaType,
      country: dto.options.country,
      samplePercent: dto.options.samplePercent,
    });

    return {
      summary: result.summary,
      items: result.items.map((item) => ({
        mediaItemId: item.mediaItemId,
        title: item.title,
        currentStatus: item.currentStatus,
        proposedStatus: item.proposedStatus,
        reasons: item.reasons,
        relevanceScore: item.relevanceScore,
        breakoutRuleId: item.breakoutRuleId,
        statusChanged: item.statusChanged,
      })),
    };
  }

  /**
   * POST /admin/catalog-policies/dry-run/diff
   * Executes a dry-run with diff against current active policy.
   */
  @Post('/dry-run/diff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Execute dry-run with diff',
    description:
      'Same as dry-run but also includes comparison against current active policy version.',
  })
  @ApiBody({
    type: DryRunRequestDto,
    description: 'Proposed policy and dry-run options',
  })
  @ApiResponse({
    status: 200,
    description: 'Dry-run results with current policy version',
    type: DryRunResponseDto,
  })
  async executeDryRunDiff(@Body() dto: DryRunRequestDto): Promise<DryRunResponseDto> {
    // Validate and normalize policy
    const normalizedPolicy = validatePolicyOrThrow({
      allowedCountries: dto.policy.allowedCountries,
      blockedCountries: dto.policy.blockedCountries,
      blockedCountryMode: dto.policy.blockedCountryMode || 'ANY',
      allowedLanguages: dto.policy.allowedLanguages,
      blockedLanguages: dto.policy.blockedLanguages,
      globalProviders: dto.policy.globalProviders || [],
      breakoutRules: dto.policy.breakoutRules || [],
      eligibilityMode: dto.policy.eligibilityMode || 'STRICT',
      homepage: dto.policy.homepage || { minRelevanceScore: 50 },
    });

    // Execute dry-run with diff
    const result = await this.dryRunService.executeDiff(normalizedPolicy, {
      mode: dto.options.mode,
      limit: dto.options.limit,
      mediaType: dto.options.mediaType,
      country: dto.options.country,
      samplePercent: dto.options.samplePercent,
    });

    return {
      summary: result.summary,
      items: result.items.map((item) => ({
        mediaItemId: item.mediaItemId,
        title: item.title,
        currentStatus: item.currentStatus,
        proposedStatus: item.proposedStatus,
        reasons: item.reasons,
        relevanceScore: item.relevanceScore,
        breakoutRuleId: item.breakoutRuleId,
        statusChanged: item.statusChanged,
      })),
      currentPolicyVersion: result.currentPolicyVersion,
    };
  }
}
