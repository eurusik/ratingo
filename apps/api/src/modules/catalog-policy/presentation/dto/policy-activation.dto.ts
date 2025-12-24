import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumber,
  IsString,
  IsBoolean,
  IsArray,
  IsEnum,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Request DTOs
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
 * Response DTOs
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
    enum: ['pending', 'running', 'success', 'failed', 'cancelled', 'promoted'],
  })
  @IsEnum(['pending', 'running', 'success', 'failed', 'cancelled', 'promoted'])
  status: string;

  @ApiProperty({
    description: 'Human-readable message',
    example:
      'Policy preparation started. Use GET /admin/catalog-policy-runs/run-123 to track progress.',
  })
  @IsString()
  message: string;
}

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
    enum: ['pending', 'running', 'success', 'failed', 'cancelled', 'promoted'],
  })
  @IsEnum(['pending', 'running', 'success', 'failed', 'cancelled', 'promoted'])
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
}

/**
 * Additional DTOs for future endpoints
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
    enum: ['running', 'success', 'failed', 'cancelled', 'promoted'],
  })
  @IsEnum(['running', 'success', 'failed', 'cancelled', 'promoted'])
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

export class PoliciesListDto {
  @ApiProperty({
    description: 'List of policies',
    type: [PolicyDto],
  })
  @Type(() => PolicyDto)
  @IsArray()
  data: PolicyDto[];
}

export class RunsListDto {
  @ApiProperty({
    description: 'List of evaluation runs',
    type: [EvaluationRunDto],
  })
  @Type(() => EvaluationRunDto)
  @IsArray()
  data: EvaluationRunDto[];
}
