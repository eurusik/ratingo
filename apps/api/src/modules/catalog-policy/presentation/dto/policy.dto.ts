/**
 * Policy DTOs
 *
 * DTOs for policy CRUD operations.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsDate,
  IsOptional,
  IsArray,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PolicyConfigDto } from './policy-config.dto';
import { BreakoutRuleDto } from './breakout-rule.dto';
import { GlobalRequirementsDto } from './global-requirements.dto';

/**
 * Policy detail DTO.
 * Complete policy information including configuration.
 */
export class PolicyDetailDto {
  @ApiProperty({
    description: 'Policy ID',
    example: 'policy-123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Policy name',
    example: 'Policy v2',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Policy version',
    example: '2',
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

  @ApiProperty({
    description: 'Policy configuration',
    type: PolicyConfigDto,
  })
  @ValidateNested()
  @Type(() => PolicyConfigDto)
  config: PolicyConfigDto;

  @ApiProperty({
    description: 'When the policy was created',
    example: '2024-12-20T10:00:00Z',
  })
  @Type(() => Date)
  @IsDate()
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'When the policy was activated',
    example: '2024-12-20T12:00:00Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  activatedAt?: Date;
}

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
 * Create policy DTO.
 * Request body for creating a new policy.
 */
export class CreatePolicyDto {
  @ApiProperty({
    description: 'Allowed countries (ISO 3166-1 alpha-2 codes)',
    example: ['US', 'GB', 'CA', 'AU', 'UA'],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  allowedCountries: string[];

  @ApiProperty({
    description: 'Blocked countries (ISO 3166-1 alpha-2 codes)',
    example: ['RU', 'BY'],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  blockedCountries: string[];

  @ApiPropertyOptional({
    description: 'Blocked country mode',
    example: 'ANY',
    enum: ['ANY', 'MAJORITY'],
  })
  @IsOptional()
  @IsEnum(['ANY', 'MAJORITY'])
  blockedCountryMode?: 'ANY' | 'MAJORITY';

  @ApiProperty({
    description: 'Allowed languages (ISO 639-1 codes)',
    example: ['en', 'uk', 'de', 'fr'],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  allowedLanguages: string[];

  @ApiProperty({
    description: 'Blocked languages (ISO 639-1 codes)',
    example: ['ru'],
    isArray: true,
  })
  @IsArray()
  @IsString({ each: true })
  blockedLanguages: string[];

  @ApiPropertyOptional({
    description: 'Global streaming providers',
    example: ['netflix', 'max', 'appletv', 'prime', 'disney'],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  globalProviders?: string[];

  @ApiPropertyOptional({
    description: 'Breakout rules for exceptions',
    type: [BreakoutRuleDto],
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BreakoutRuleDto)
  breakoutRules?: BreakoutRuleDto[];

  @ApiPropertyOptional({
    description: 'Eligibility mode',
    example: 'STRICT',
    enum: ['STRICT', 'RELAXED'],
  })
  @IsOptional()
  @IsEnum(['STRICT', 'RELAXED'])
  eligibilityMode?: 'STRICT' | 'RELAXED';

  @ApiPropertyOptional({
    description: 'Homepage configuration',
    example: { minRelevanceScore: 50 },
  })
  @IsOptional()
  homepage?: { minRelevanceScore?: number };

  @ApiPropertyOptional({
    description: 'Global quality gate requirements (all conditions combined with AND)',
    type: GlobalRequirementsDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GlobalRequirementsDto)
  globalRequirements?: GlobalRequirementsDto;
}

/**
 * Create policy response DTO.
 * Returns created policy ID and version.
 */
export class CreatePolicyResponseDto {
  @ApiProperty({
    description: 'Created policy ID',
    example: 'policy-123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Policy version',
    example: 2,
  })
  @IsNumber()
  version: number;

  @ApiProperty({
    description: 'Human-readable message',
    example:
      'Policy v2 created successfully. Use POST /admin/catalog-policies/:id/prepare to start evaluation.',
  })
  @IsString()
  message: string;
}
