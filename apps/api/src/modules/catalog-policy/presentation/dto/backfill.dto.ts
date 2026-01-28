/**
 * Backfill DTOs
 *
 * DTOs for context backfill operations.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsString, IsNumber, IsOptional, IsIn } from 'class-validator';

import { EVALUATION_CONTEXTS, type EvaluationContextType, RUN_STATUSES } from './constants';

/**
 * Backfill request DTO.
 * Specifies which context to backfill.
 */
export class BackfillRequestDto {
  @ApiProperty({
    description: 'Evaluation context to backfill',
    example: 'trending',
    enum: EVALUATION_CONTEXTS,
  })
  @IsString()
  @IsIn([...EVALUATION_CONTEXTS])
  context: EvaluationContextType;

  @ApiPropertyOptional({
    description: 'Batch size for processing items',
    example: 500,
    minimum: 1,
    maximum: 1000,
  })
  @IsOptional()
  @IsNumber()
  batchSize?: number;
}

/**
 * Backfill response DTO.
 * Returns run ID for tracking backfill progress.
 */
export class BackfillResponseDto {
  @ApiProperty({
    description: 'ID of the created backfill run',
    example: 'run-123e4567-e89b-12d3-a456-426614174000',
  })
  runId: string;

  @ApiProperty({
    description: 'Current status of the run',
    example: 'running',
    enum: RUN_STATUSES,
  })
  status: string;

  @ApiProperty({
    description: 'Context being backfilled',
    example: 'trending',
    enum: EVALUATION_CONTEXTS,
  })
  context: string;

  @ApiProperty({
    description: 'Human-readable message',
    example:
      'Backfill started for context=trending. Use GET /admin/catalog-policies/runs/run-123 to track progress.',
  })
  message: string;
}
