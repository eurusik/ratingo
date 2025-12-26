/**
 * Policy Controller
 *
 * Admin API endpoints for policy CRUD operations.
 * Handles policy listing, creation, and preparation.
 */

import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus, Inject } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
import { PolicyActivationService } from '../../application/services/policy-activation.service';
import { CatalogPolicyService } from '../../application/services/catalog-policy.service';
import {
  CATALOG_POLICY_REPOSITORY,
  ICatalogPolicyRepository,
} from '../../infrastructure/repositories/catalog-policy.repository';
import {
  PrepareOptionsDto,
  PrepareResponseDto,
  PoliciesListDto,
  PolicyDto,
  CreatePolicyDto,
  CreatePolicyResponseDto,
} from '../dto/policy-activation.dto';

@ApiTags('Admin - Policy Activation')
@Controller('admin/catalog-policies')
export class PolicyController {
  constructor(
    private readonly policyActivationService: PolicyActivationService,
    private readonly catalogPolicyService: CatalogPolicyService,
    @Inject(CATALOG_POLICY_REPOSITORY)
    private readonly policyRepository: ICatalogPolicyRepository,
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
}
