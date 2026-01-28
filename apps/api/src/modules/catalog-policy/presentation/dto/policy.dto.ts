/**
 * Policy DTOs
 *
 * DTOs for policy CRUD operations.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsString, IsOptional, IsArray, ValidateNested, IsIn } from 'class-validator';

import { PolicyStatus, type PolicyStatusType } from '../../catalog-policy.constants';

import { BreakoutRuleDto } from './breakout-rule.dto';
import {
  ELIGIBILITY_MODES,
  BLOCKED_COUNTRY_MODES,
  CONTENT_CLASSES,
  type ContentClassType,
} from './constants';
import { type ContextRequirementsDto } from './context-requirements.dto';
import { GlobalRequirementsDto } from './global-requirements.dto';
import { HomepageConfigDto, PolicyConfigDto } from './policy-config.dto';

const POLICY_STATUS_VALUES = Object.values(PolicyStatus);

/**
 * Policy detail DTO.
 * Complete policy information including configuration.
 */
export class PolicyDetailDto {
  @ApiProperty({
    description: 'Policy ID',
    example: 'policy-123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Policy name',
    example: 'Policy v2',
  })
  name: string;

  @ApiProperty({
    description: 'Policy version',
    example: '2',
  })
  version: string;

  @ApiProperty({
    description: 'Policy status',
    example: 'active',
    enum: POLICY_STATUS_VALUES,
  })
  status: PolicyStatusType;

  @ApiProperty({
    description: 'Policy configuration',
    type: PolicyConfigDto,
  })
  @Type(() => PolicyConfigDto)
  config: PolicyConfigDto;

  @ApiProperty({
    description: 'When the policy was created',
    example: '2024-12-20T10:00:00Z',
  })
  @Type(() => Date)
  createdAt: Date;

  @ApiPropertyOptional({
    description: 'When the policy was activated',
    example: '2024-12-20T12:00:00Z',
  })
  @Type(() => Date)
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
  id: string;

  @ApiProperty({
    description: 'Policy name',
    example: 'Content Filtering Policy',
  })
  name: string;

  @ApiProperty({
    description: 'Policy version',
    example: '1.0',
  })
  version: string;

  @ApiProperty({
    description: 'Policy status',
    example: 'active',
    enum: POLICY_STATUS_VALUES,
  })
  status: PolicyStatusType;

  @ApiPropertyOptional({
    description: 'Policy description',
    example: 'Filters content based on quality and popularity thresholds',
  })
  description?: string;

  @ApiProperty({
    description: 'When the policy was last updated',
    example: '2024-12-20T10:00:00Z',
  })
  @Type(() => Date)
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
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  allowedCountries: string[];

  @ApiProperty({
    description: 'Blocked countries (ISO 3166-1 alpha-2 codes)',
    example: ['RU', 'BY'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  blockedCountries: string[];

  @ApiPropertyOptional({
    description: 'Blocked country mode',
    example: 'ANY',
    enum: BLOCKED_COUNTRY_MODES,
  })
  @IsOptional()
  @IsIn([...BLOCKED_COUNTRY_MODES])
  blockedCountryMode?: 'ANY' | 'MAJORITY';

  @ApiProperty({
    description: 'Allowed languages (ISO 639-1 codes)',
    example: ['en', 'uk', 'de', 'fr'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  allowedLanguages: string[];

  @ApiProperty({
    description: 'Blocked languages (ISO 639-1 codes)',
    example: ['ru'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  blockedLanguages: string[];

  @ApiPropertyOptional({
    description: 'Global streaming providers',
    example: ['netflix', 'max', 'appletv', 'prime', 'disney'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  globalProviders?: string[];

  @ApiPropertyOptional({
    description: 'Breakout rules for exceptions',
    type: [BreakoutRuleDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BreakoutRuleDto)
  breakoutRules?: BreakoutRuleDto[];

  @ApiPropertyOptional({
    description: 'Eligibility mode',
    example: 'STRICT',
    enum: ELIGIBILITY_MODES,
  })
  @IsOptional()
  @IsIn([...ELIGIBILITY_MODES])
  eligibilityMode?: 'STRICT' | 'RELAXED';

  @ApiPropertyOptional({
    description: 'Homepage configuration',
    example: { minRelevanceScore: 50 },
    type: () => HomepageConfigDto,
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

  @ApiPropertyOptional({
    description:
      'Content classes to exclude from catalog. SOFT filter: breakout rules CAN override.',
    example: ['anime', 'reality'],
    enum: CONTENT_CLASSES,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsIn([...CONTENT_CLASSES], { each: true })
  excludedContentClasses?: ContentClassType[];

  @ApiPropertyOptional({
    description: 'Context-specific requirements for display surfaces (readability, overview)',
    example: {
      trending: { requireReadableTitle: true, requireOverview: true, minOverviewChars: 60 },
      homepage: { requireReadableTitle: true, requireOverview: true, minOverviewChars: 60 },
      catalog: { requireReadableTitle: true },
    },
  })
  @IsOptional()
  contextRequirements?: Record<string, ContextRequirementsDto>;
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
  id: string;

  @ApiProperty({
    description: 'Policy version',
    example: 2,
  })
  version: number;

  @ApiProperty({
    description: 'Human-readable message',
    example:
      'Policy v2 created successfully. Use POST /admin/catalog-policies/:id/prepare to start evaluation.',
  })
  message: string;
}
