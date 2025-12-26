/**
 * Diff Report DTOs
 *
 * DTOs for policy comparison and impact analysis.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsArray, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Diff sample DTO.
 * Represents a single item in diff report.
 */
export class DiffSampleDto {
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

  @ApiProperty({
    description: 'Reason for the change',
    example: 'Quality threshold updated',
  })
  @IsString()
  reason: string;
}

/**
 * Diff counts DTO.
 * Summary of changes between policies.
 */
export class DiffCountsDto {
  @ApiProperty({
    description: 'Number of items that will be removed from catalog',
    example: 25,
  })
  @IsNumber()
  regressions: number;

  @ApiProperty({
    description: 'Number of items that will be added to catalog',
    example: 150,
  })
  @IsNumber()
  improvements: number;

  @ApiProperty({
    description: 'Net change in catalog size',
    example: 125,
  })
  @IsNumber()
  netChange: number;
}

/**
 * Reason breakdown DTO.
 * Breakdown of regressions by reason.
 */
export class ReasonBreakdownDto {
  @ApiProperty({
    description: 'Breakdown of regression reasons',
    example: { MISSING_GLOBAL_SIGNALS: 150, BLOCKED_COUNTRY: 25, NEUTRAL_LANGUAGE: 10 },
    additionalProperties: { type: 'number' },
  })
  regressionReasons: Record<string, number>;

  @ApiProperty({
    description: 'Breakdown of improvement reasons',
    example: { ALLOWED_COUNTRY: 100, BREAKOUT_ALLOWED: 50 },
    additionalProperties: { type: 'number' },
  })
  improvementReasons: Record<string, number>;
}

/**
 * Diff report DTO.
 * Complete diff report between current and target policy.
 */
export class DiffReportDto {
  @ApiProperty({
    description: 'Run ID',
    example: 'run-123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  runId: string;

  @ApiProperty({
    description: 'Target policy version',
    example: 2,
  })
  @IsNumber()
  targetPolicyVersion: number;

  @ApiPropertyOptional({
    description: 'Current active policy version',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  currentPolicyVersion?: number;

  @ApiProperty({
    description: 'Summary of changes',
    type: DiffCountsDto,
  })
  @Type(() => DiffCountsDto)
  counts: DiffCountsDto;

  @ApiProperty({
    description: 'Sample items being removed from catalog',
    type: [DiffSampleDto],
  })
  @Type(() => DiffSampleDto)
  @IsArray()
  topRegressions: DiffSampleDto[];

  @ApiProperty({
    description: 'Sample items being added to catalog',
    type: [DiffSampleDto],
  })
  @Type(() => DiffSampleDto)
  @IsArray()
  topImprovements: DiffSampleDto[];

  @ApiPropertyOptional({
    description: 'Breakdown of reasons for regressions and improvements',
    type: ReasonBreakdownDto,
  })
  @IsOptional()
  @Type(() => ReasonBreakdownDto)
  reasonBreakdown?: ReasonBreakdownDto;
}
