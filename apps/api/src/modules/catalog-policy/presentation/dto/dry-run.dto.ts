/**
 * Dry-Run DTOs
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsOptional,
  IsNumber,
  IsString,
  IsIn,
  ValidateNested,
  Min,
  Max,
  Matches,
} from 'class-validator';

import { DRY_RUN_MODES, type DryRunModeType, MEDIA_TYPES, ELIGIBILITY_STATUSES } from './constants';
import { CreatePolicyDto } from './policy.dto';

export class DryRunOptionsDto {
  @ApiProperty({
    description: 'Selection mode for items to evaluate',
    example: 'sample',
    enum: DRY_RUN_MODES,
  })
  @IsIn([...DRY_RUN_MODES])
  mode: DryRunModeType;

  @ApiPropertyOptional({
    description: 'Maximum number of items to evaluate (default: 1000, max: 10000)',
    example: 1000,
    minimum: 1,
    maximum: 10000,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Media type filter (required for byType mode)',
    example: 'movie',
    enum: MEDIA_TYPES,
  })
  @IsOptional()
  @IsIn([...MEDIA_TYPES])
  mediaType?: 'movie' | 'show';

  @ApiPropertyOptional({
    description: 'Country filter (ISO 3166-1 alpha-2, required for byCountry mode)',
    example: 'US',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, {
    message: 'country must be a valid ISO 3166-1 alpha-2 code (e.g., US, GB, UA)',
  })
  country?: string;

  @ApiPropertyOptional({
    description: 'Sample percentage for sample mode (1-100)',
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  samplePercent?: number;
}

export class DryRunRequestDto {
  @ApiProperty({
    description: 'Proposed policy configuration to test',
    type: CreatePolicyDto,
  })
  @ValidateNested()
  @Type(() => CreatePolicyDto)
  policy: CreatePolicyDto;

  @ApiProperty({
    description: 'Dry-run options',
    type: DryRunOptionsDto,
  })
  @ValidateNested()
  @Type(() => DryRunOptionsDto)
  options: DryRunOptionsDto;
}

export class DryRunItemResultDto {
  @ApiProperty({
    description: 'Media item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  mediaItemId: string;

  @ApiProperty({
    description: 'Media item title',
    example: 'The Matrix',
  })
  title: string;

  @ApiPropertyOptional({
    description: 'Current eligibility status (null if not evaluated)',
    example: 'ELIGIBLE',
    enum: ELIGIBILITY_STATUSES,
  })
  currentStatus?: string | null;

  @ApiProperty({
    description: 'Proposed eligibility status under new policy',
    example: 'ELIGIBLE',
    enum: ELIGIBILITY_STATUSES,
  })
  proposedStatus: string;

  @ApiProperty({
    description: 'Evaluation reasons',
    example: ['ALLOWED_COUNTRY', 'ALLOWED_LANGUAGE'],
    type: [String],
  })
  reasons: string[];

  @ApiProperty({
    description: 'Relevance score (0-100)',
    example: 75,
  })
  relevanceScore: number;

  @ApiPropertyOptional({
    description: 'Breakout rule ID if applicable',
    example: 'GLOBAL_HIT',
  })
  breakoutRuleId?: string | null;

  @ApiProperty({
    description: 'Whether status changed from current',
    example: false,
  })
  statusChanged: boolean;
}

/**
 * Reason count DTO.
 * Single reason with count for dry-run breakdown.
 */
export class ReasonCountDto {
  @ApiProperty({
    description: 'Evaluation reason',
    example: 'ALLOWED_COUNTRY',
  })
  reason: string;

  @ApiProperty({
    description: 'Count of items with this reason',
    example: 500,
  })
  count: number;
}

export class DryRunSummaryDto {
  @ApiProperty({
    description: 'Total items evaluated',
    example: 1000,
  })
  totalEvaluated: number;

  @ApiProperty({
    description: 'Items that would be eligible',
    example: 750,
  })
  eligible: number;

  @ApiProperty({
    description: 'Items that would be ineligible',
    example: 200,
  })
  ineligible: number;

  @ApiProperty({
    description: 'Items that would need review',
    example: 10,
  })
  review: number;

  @ApiProperty({
    description: 'Items that would become newly eligible',
    example: 50,
  })
  newlyEligible: number;

  @ApiProperty({
    description: 'Items that would become newly ineligible',
    example: 25,
  })
  newlyIneligible: number;

  @ApiProperty({
    description: 'Items with unchanged status',
    example: 925,
  })
  unchanged: number;

  @ApiProperty({
    description: 'Items without previous evaluation (first-time evaluation)',
    example: 40,
  })
  newItems: number;

  @ApiProperty({
    description: 'Breakdown of evaluation reasons',
    type: [ReasonCountDto],
  })
  @Type(() => ReasonCountDto)
  reasonBreakdown: ReasonCountDto[];

  @ApiProperty({
    description: 'Execution time in milliseconds',
    example: 1500,
  })
  executionTimeMs: number;

  @ApiProperty({
    description: 'Selection mode used',
    example: 'sample',
    enum: DRY_RUN_MODES,
  })
  mode: string;

  @ApiProperty({
    description: 'Item limit used',
    example: 1000,
  })
  limit: number;

  @ApiProperty({
    description: 'Whether evaluation was stopped due to timeout',
    example: false,
  })
  timedOut: boolean;
}

export class DryRunResponseDto {
  @ApiProperty({
    description: 'Dry-run summary',
    type: DryRunSummaryDto,
  })
  @Type(() => DryRunSummaryDto)
  summary: DryRunSummaryDto;

  @ApiProperty({
    description: 'Individual item results',
    type: [DryRunItemResultDto],
  })
  @Type(() => DryRunItemResultDto)
  items: DryRunItemResultDto[];

  @ApiPropertyOptional({
    description: 'Current active policy version (for diff mode)',
    example: 1,
  })
  currentPolicyVersion?: number | null;
}
