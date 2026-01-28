/**
 * Dry-Run Controller
 *
 * Admin endpoints for testing policy changes without persisting results.
 */

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';

import { AdminJwtGuard } from '../../../auth/infrastructure/guards/admin-jwt.guard';
import { DryRunService, type DryRunResult } from '../../application/services/dry-run.service';
import { validatePolicyOrThrow } from '../../domain/validation/policy.schema';
import { DryRunRequestDto, DryRunResponseDto } from '../dto/dry-run.dto';
import { DryRunExceptionFilter } from '../filters/dry-run-exception.filter';

@ApiTags('Admin - Policy Activation')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard)
@UseFilters(DryRunExceptionFilter)
@Controller('admin/catalog-policies/dry-run')
export class DryRunController {
  constructor(private readonly dryRunService: DryRunService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Execute dry-run evaluation',
    description:
      'Evaluates media items against a proposed policy WITHOUT persisting results. ' +
      'Supports multiple selection modes: sample (random), top (by popularity), byType, byCountry. ' +
      'Limits: max 10000 items, 60s timeout.',
  })
  @ApiBody({ type: DryRunRequestDto })
  @ApiResponse({ status: 200, type: DryRunResponseDto })
  async executeDryRun(@Body() dto: DryRunRequestDto): Promise<DryRunResponseDto> {
    const result = await this.dryRunService.execute(
      this.normalizePolicy(dto),
      this.extractOptions(dto),
    );
    return this.mapResponse(result);
  }

  @Post('diff')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Execute dry-run with diff',
    description: 'Same as dry-run but includes comparison against current active policy version.',
  })
  @ApiBody({ type: DryRunRequestDto })
  @ApiResponse({ status: 200, type: DryRunResponseDto })
  async executeDryRunDiff(@Body() dto: DryRunRequestDto): Promise<DryRunResponseDto> {
    const result = await this.dryRunService.executeDiff(
      this.normalizePolicy(dto),
      this.extractOptions(dto),
    );
    return {
      ...this.mapResponse(result),
      currentPolicyVersion: result.currentPolicyVersion,
    };
  }

  private normalizePolicy(dto: DryRunRequestDto) {
    return validatePolicyOrThrow({
      allowedCountries: dto.policy.allowedCountries,
      blockedCountries: dto.policy.blockedCountries,
      blockedCountryMode: dto.policy.blockedCountryMode || 'ANY',
      allowedLanguages: dto.policy.allowedLanguages,
      blockedLanguages: dto.policy.blockedLanguages,
      globalProviders: dto.policy.globalProviders || [],
      breakoutRules: dto.policy.breakoutRules || [],
      eligibilityMode: dto.policy.eligibilityMode || 'STRICT',
      homepage: dto.policy.homepage || { minRelevanceScore: 50 },
      globalRequirements: dto.policy.globalRequirements,
      excludedContentClasses: dto.policy.excludedContentClasses || [],
    });
  }

  private extractOptions(dto: DryRunRequestDto) {
    return {
      mode: dto.options.mode,
      limit: dto.options.limit,
      mediaType: dto.options.mediaType,
      country: dto.options.country,
      samplePercent: dto.options.samplePercent,
    };
  }

  private mapResponse(result: DryRunResult): DryRunResponseDto {
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
}
