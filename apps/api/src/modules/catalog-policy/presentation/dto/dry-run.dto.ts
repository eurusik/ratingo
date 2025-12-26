/**
 * Dry-Run DTOs
 *
 * Request and response DTOs for policy dry-run testing.
 * Allows testing policy changes without persisting results.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumber,
  IsString,
  IsArray,
  IsEnum,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreatePolicyDto } from './policy-activation.dto';

/**
 * Dry-run mode selection.
 */
export type DryRunModeType = 'sample' | 'top' | 'byType' | 'byCountry';

/**
 * Dry-run options DTO.
 * Configuration for dry-run evaluation.
 */
export class DryRunOptionsDto {
  @ApiProperty({
    description: 'Selection mode for items to evaluate',
    example: 'sample',
    enum: ['sample', 'top', 'byType', 'byCountry'],
  })
  @IsEnum(['sample', 'top', 'byType', 'byCountry'])
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
    enum: ['movie', 'show'],
  })
  @IsOptional()
  @IsEnum(['movie', 'show'])
  mediaType?: 'movie' | 'show';

  @ApiPropertyOptional({
    description: 'Country filter (ISO 3166-1 alpha-2, required for byCountry mode)',
    example: 'US',
  })
  @IsOptional()
  @IsString()
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

/**
 * Dry-run request DTO.
 * Request body for dry-run evaluation.
 */
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

/**
 * Dry-run item result DTO.
 * Single item evaluation result in dry-run response.
 */
export class DryRunItemResultDto {
  @ApiProperty({
    description: 'Media item ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  mediaItemId: string;

  @ApiProperty({
    description: 'Media item title',
    example: 'The Matrix',
  })
  @IsString()
  title: string;

  @ApiPropertyOptional({
    description: 'Current eligibility status (null if not evaluated)',
    example: 'ELIGIBLE',
    enum: ['PENDING', 'ELIGIBLE', 'INELIGIBLE', 'REVIEW'],
  })
  @IsOptional()
  @IsString()
  currentStatus?: string | null;

  @ApiProperty({
    description: 'Proposed eligibility status under new policy',
    example: 'ELIGIBLE',
    enum: ['PENDING', 'ELIGIBLE', 'INELIGIBLE', 'REVIEW'],
  })
  @IsString()
  proposedStatus: string;

  @ApiProperty({
    description: 'Evaluation reasons',
    example: ['ALLOWED_COUNTRY', 'ALLOWED_LANGUAGE'],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  reasons: string[];

  @ApiProperty({
    description: 'Relevance score (0-100)',
    example: 75,
  })
  @IsNumber()
  relevanceScore: number;

  @ApiPropertyOptional({
    description: 'Breakout rule ID if applicable',
    example: 'GLOBAL_HIT',
  })
  @IsOptional()
  @IsString()
  breakoutRuleId?: string | null;

  @ApiProperty({
    description: 'Whether status changed from current',
    example: false,
  })
  statusChanged: boolean;
}

/**
 * Reason breakdown DTO.
 * Count of items by evaluation reason.
 */
export class ReasonBreakdownDto {
  @ApiProperty({
    description: 'Evaluation reason',
    example: 'ALLOWED_COUNTRY',
  })
  @IsString()
  reason: string;

  @ApiProperty({
    description: 'Count of items with this reason',
    example: 500,
  })
  @IsNumber()
  count: number;
}

/**
 * Dry-run summary DTO.
 * Aggregated statistics for dry-run evaluation.
 */
export class DryRunSummaryDto {
  @ApiProperty({
    description: 'Total items evaluated',
    example: 1000,
  })
  @IsNumber()
  totalEvaluated: number;

  @ApiProperty({
    description: 'Items that would be eligible',
    example: 750,
  })
  @IsNumber()
  eligible: number;

  @ApiProperty({
    description: 'Items that would be ineligible',
    example: 200,
  })
  @IsNumber()
  ineligible: number;

  @ApiProperty({
    description: 'Items that would be pending',
    example: 40,
  })
  @IsNumber()
  pending: number;

  @ApiProperty({
    description: 'Items that would need review',
    example: 10,
  })
  @IsNumber()
  review: number;

  @ApiProperty({
    description: 'Items that would become newly eligible',
    example: 50,
  })
  @IsNumber()
  newlyEligible: number;

  @ApiProperty({
    description: 'Items that would become newly ineligible',
    example: 25,
  })
  @IsNumber()
  newlyIneligible: number;

  @ApiProperty({
    description: 'Items with unchanged status',
    example: 925,
  })
  @IsNumber()
  unchanged: number;

  @ApiProperty({
    description: 'Breakdown of evaluation reasons',
    type: [ReasonBreakdownDto],
  })
  @Type(() => ReasonBreakdownDto)
  @IsArray()
  reasonBreakdown: ReasonBreakdownDto[];

  @ApiProperty({
    description: 'Execution time in milliseconds',
    example: 1500,
  })
  @IsNumber()
  executionTimeMs: number;

  @ApiProperty({
    description: 'Selection mode used',
    example: 'sample',
    enum: ['sample', 'top', 'byType', 'byCountry'],
  })
  @IsString()
  mode: string;

  @ApiProperty({
    description: 'Item limit used',
    example: 1000,
  })
  @IsNumber()
  limit: number;
}

/**
 * Dry-run response DTO.
 * Complete dry-run evaluation results.
 */
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
  @IsArray()
  items: DryRunItemResultDto[];

  @ApiPropertyOptional({
    description: 'Current active policy version (for diff mode)',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  currentPolicyVersion?: number | null;
}
