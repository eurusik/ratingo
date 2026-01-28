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
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';

import { AdminJwtGuard } from '../../../auth/infrastructure/guards/admin-jwt.guard';
import { PolicyMapper } from '../../application/mappers/policy.mapper';
import { CatalogPolicyService } from '../../application/services/catalog-policy.service';
import { PolicyActivationService } from '../../application/services/policy-activation.service';
import {
  PrepareOptionsDto,
  PrepareResponseDto,
  PoliciesListDto,
  PolicyDetailDto,
  CreatePolicyDto,
  CreatePolicyResponseDto,
} from '../dto';

@ApiTags('Admin - Policy Activation')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@Controller('admin/catalog-policies')
export class PolicyController {
  constructor(
    private readonly policyActivationService: PolicyActivationService,
    private readonly catalogPolicyService: CatalogPolicyService,
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
    const policies = await this.catalogPolicyService.listAll();
    return { data: PolicyMapper.toListDtos(policies) };
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
    const policy = await this.catalogPolicyService.getById(policyId);

    if (!policy) {
      throw new NotFoundException(`Policy with ID ${policyId} not found`);
    }

    return PolicyMapper.toDetailDto(policy);
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
