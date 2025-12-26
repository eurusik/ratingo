/**
 * List DTOs
 *
 * DTOs for listing policies and evaluation runs.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsDate, IsBoolean, IsArray, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ProgressStatsDto } from './run-status.dto';

/**
 * Policy DTO.
 * Basic policy information for listing.
 */
export class PolicyDto {
  @ApiProperty({
    description: 'Policy ID',
    example: 'policy-123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Policy name',
    example: 'Content Filtering Policy',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Policy version',
    example: '1.0',
  })
  @IsString()
  version: string;

  @ApiProperty({
    description: 'Policy status',
    example: 'active',
    enum: ['active', 'inactive'],
  })
  @IsEnum(['active', 'inactive'])
  status: string;

  @ApiPropertyOptional({
    description: 'Policy description',
    example: 'Filters content based on quality and popularity thresholds',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'When the policy was last updated',
    example: '2024-12-20T10:00:00Z',
  })
  @Type(() => Date)
  @IsDate()
  updatedAt: Date;
}

/**
 * Evaluation run DTO.
 * Basic run information for listing.
 */
export class EvaluationRunDto {
  @ApiProperty({
    description: 'Run ID',
    example: 'run-123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Policy ID',
    example: 'policy-456e7890-f12a-34b5-c678-901234567890',
  })
  @IsString()
  policyId: string;

  @ApiProperty({
    description: 'Policy name',
    example: 'Content Filtering Policy',
  })
  @IsString()
  policyName: string;

  @ApiProperty({
    description: 'Run status',
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
    description: 'Whether the run is ready to be promoted',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  readyToPromote?: boolean;
}

/**
 * Policies list DTO.
 * Wrapper for policy list response.
 */
export class PoliciesListDto {
  @ApiProperty({
    description: 'List of policies',
    type: [PolicyDto],
  })
  @Type(() => PolicyDto)
  @IsArray()
  data: PolicyDto[];
}

/**
 * Runs list DTO.
 * Wrapper for evaluation runs list response.
 */
export class RunsListDto {
  @ApiProperty({
    description: 'List of evaluation runs',
    type: [EvaluationRunDto],
  })
  @Type(() => EvaluationRunDto)
  @IsArray()
  data: EvaluationRunDto[];
}
