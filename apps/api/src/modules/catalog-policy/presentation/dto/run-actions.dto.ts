/**
 * Run Actions DTOs
 *
 * DTOs for prepare, promote, and cancel actions.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsEnum, IsBoolean, IsOptional } from 'class-validator';

/**
 * Prepare options DTO.
 * Configuration for policy preparation phase.
 */
export class PrepareOptionsDto {
  @ApiPropertyOptional({
    description: 'Batch size for processing items',
    example: 500,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @IsNumber()
  batchSize?: number;

  @ApiPropertyOptional({
    description: 'Number of concurrent workers',
    example: 10,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @IsNumber()
  concurrency?: number;
}

/**
 * Promote options DTO.
 * Thresholds for policy promotion validation.
 */
export class PromoteOptionsDto {
  @ApiPropertyOptional({
    description: 'Coverage threshold (0.0 to 1.0)',
    example: 1.0,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber()
  coverageThreshold?: number;

  @ApiPropertyOptional({
    description: 'Maximum allowed errors',
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  maxErrors?: number;
}

/**
 * Prepare response DTO.
 * Returns run ID for tracking preparation progress.
 */
export class PrepareResponseDto {
  @ApiProperty({
    description: 'ID of the created evaluation run',
    example: 'run-123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  runId: string;

  @ApiProperty({
    description: 'Current status of the run',
    example: 'running',
    enum: ['running', 'prepared', 'failed', 'cancelled', 'promoted'],
  })
  @IsEnum(['running', 'prepared', 'failed', 'cancelled', 'promoted'])
  status: string;

  @ApiProperty({
    description: 'Human-readable message',
    example:
      'Policy preparation started. Use GET /admin/catalog-policy-runs/run-123 to track progress.',
  })
  @IsString()
  message: string;
}

/**
 * Action response DTO.
 * Generic response for promote/cancel actions.
 */
export class ActionResponseDto {
  @ApiProperty({
    description: 'Whether the action was successful',
    example: true,
  })
  @IsBoolean()
  success: boolean;

  @ApiPropertyOptional({
    description: 'Error message if action failed',
    example: 'Run is not ready to promote: coverage threshold not met',
  })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiPropertyOptional({
    description: 'Success message',
    example: 'Policy activated successfully',
  })
  @IsOptional()
  @IsString()
  message?: string;
}
