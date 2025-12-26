/**
 * Run Status DTOs
 *
 * DTOs for tracking evaluation run progress and status.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsDate,
  IsBoolean,
  IsArray,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Progress statistics DTO.
 * Tracks evaluation progress for a run.
 */
export class ProgressStatsDto {
  @ApiProperty({
    description: 'Number of items processed',
    example: 750,
  })
  @IsNumber()
  processed: number;

  @ApiProperty({
    description: 'Total number of items to process',
    example: 1200,
  })
  @IsNumber()
  total: number;

  @ApiProperty({
    description: 'Number of eligible items',
    example: 600,
  })
  @IsNumber()
  eligible: number;

  @ApiProperty({
    description: 'Number of ineligible items',
    example: 100,
  })
  @IsNumber()
  ineligible: number;

  @ApiProperty({
    description: 'Number of pending items',
    example: 450,
  })
  @IsNumber()
  pending: number;

  @ApiProperty({
    description: 'Number of errors encountered',
    example: 50,
  })
  @IsNumber()
  errors: number;
}

/**
 * Error sample DTO.
 * Represents a single error encountered during evaluation.
 */
export class ErrorSampleDto {
  @ApiProperty({
    description: 'Media item ID that caused the error',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  mediaItemId: string;

  @ApiProperty({
    description: 'Error message',
    example: 'Missing origin country data',
  })
  @IsString()
  error: string;

  @ApiPropertyOptional({
    description: 'Error stack trace',
  })
  @IsOptional()
  @IsString()
  stack?: string;

  @ApiProperty({
    description: 'When the error occurred',
    example: '2024-12-20T14:30:00Z',
  })
  @IsString()
  timestamp: string;
}

/**
 * Run status DTO.
 * Complete status information for an evaluation run.
 */
export class RunStatusDto {
  @ApiProperty({
    description: 'Run ID',
    example: 'run-123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Target policy ID',
    example: 'policy-456e7890-f12a-34b5-c678-901234567890',
  })
  @IsString()
  targetPolicyId: string;

  @ApiProperty({
    description: 'Target policy version',
    example: 2,
  })
  @IsNumber()
  targetPolicyVersion: number;

  @ApiProperty({
    description: 'Current run status',
    example: 'running',
    enum: ['running', 'prepared', 'failed', 'cancelled', 'promoted'],
  })
  @IsEnum(['running', 'prepared', 'failed', 'cancelled', 'promoted'])
  status: string;

  @ApiProperty({
    description: 'Progress statistics',
    type: ProgressStatsDto,
  })
  @Type(() => ProgressStatsDto)
  progress: ProgressStatsDto;

  @ApiProperty({
    description: 'When the run started',
    example: '2024-12-20T14:00:00Z',
  })
  @Type(() => Date)
  @IsDate()
  startedAt: Date;

  @ApiPropertyOptional({
    description: 'When the run finished',
    example: '2024-12-20T14:30:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  finishedAt?: Date;

  @ApiPropertyOptional({
    description: 'When the run was promoted',
    example: '2024-12-20T15:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  promotedAt?: Date;

  @ApiPropertyOptional({
    description: 'Who promoted the run',
    example: 'admin@example.com',
  })
  @IsOptional()
  @IsString()
  promotedBy?: string;

  @ApiProperty({
    description: 'Whether the run is ready to be promoted',
    example: true,
  })
  @IsBoolean()
  readyToPromote: boolean;

  @ApiProperty({
    description: 'Reasons why the run cannot be promoted (if any)',
    example: ['COVERAGE_NOT_MET'],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  blockingReasons: string[];

  @ApiProperty({
    description: 'Coverage percentage (0.0 to 1.0)',
    example: 0.95,
  })
  @IsNumber()
  coverage: number;

  @ApiProperty({
    description: 'Sample of errors encountered',
    type: [ErrorSampleDto],
  })
  @Type(() => ErrorSampleDto)
  @IsArray()
  errorSample: ErrorSampleDto[];
}
