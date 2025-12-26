/**
 * Dry-Run Controller
 *
 * Admin endpoints for testing policy changes without persisting results.
 */

import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { DryRunService } from '../../application/services/dry-run.service';
import { DryRunRequestDto, DryRunResponseDto } from '../dto/dry-run.dto';
import { validatePolicyOrThrow } from '../../domain/validation/policy.schema';

@ApiTags('Admin - Policy Activation')
@Controller('admin/catalog-policies/dry-run')
export class DryRunController {
  constructor(private readonly dryRunService: DryRunService) {}

  /**
   * Executes dry-run evaluation against a proposed policy.
   *
   * @param dto - Proposed policy and dry-run options
   * @returns Dry-run results with summary and item details
   */
  @Post()
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
  @Post('diff')
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
