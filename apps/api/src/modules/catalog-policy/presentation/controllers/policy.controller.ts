/**
 * Policy Controller
 *
 * Admin endpoints for policy management (CRUD operations).
 */

import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
} from '@nestjs/common';
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
  PolicyDetailDto,
  CreatePolicyDto,
  CreatePolicyResponseDto,
} from '../dto';

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
   * Gets list of all policies.
   *
   * @returns List of policies with metadata
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
   * Gets a single policy by ID with full configuration.
   *
   * @param policyId - Policy ID
   * @returns Policy with full configuration
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get policy details',
    description: 'Returns a single policy with full configuration settings.',
  })
  @ApiParam({
    name: 'id',
    description: 'Policy ID',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Policy details',
    type: PolicyDetailDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Policy not found',
  })
  async getPolicyById(@Param('id') policyId: string): Promise<PolicyDetailDto> {
    const policy = await this.policyRepository.findById(policyId);

    if (!policy) {
      throw new NotFoundException(`Policy with ID ${policyId} not found`);
    }

    return {
      id: policy.id,
      name: `Policy v${policy.version}`,
      version: String(policy.version),
      status: policy.isActive ? 'active' : 'inactive',
      config: {
        allowedCountries: policy.policy.allowedCountries,
        blockedCountries: policy.policy.blockedCountries,
        blockedCountryMode: policy.policy.blockedCountryMode,
        allowedLanguages: policy.policy.allowedLanguages,
        blockedLanguages: policy.policy.blockedLanguages,
        globalProviders: policy.policy.globalProviders,
        breakoutRules: policy.policy.breakoutRules,
        eligibilityMode: policy.policy.eligibilityMode,
        homepage: policy.policy.homepage,
        globalRequirements: policy.policy.globalRequirements,
      },
      createdAt: policy.createdAt,
      activatedAt: policy.activatedAt ?? undefined,
    };
  }

  /**
   * Creates a new policy draft.
   *
   * @param dto - Policy configuration
   * @returns Created policy ID and version
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
   * Prepares policy for activation by pre-computing evaluations.
   *
   * @param policyId - Policy ID to prepare
   * @param options - Batch size and concurrency settings
   * @returns Run ID for tracking progress
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
