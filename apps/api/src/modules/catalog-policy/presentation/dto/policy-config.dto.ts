/**
 * Policy Configuration DTOs
 *
 * Configuration settings for catalog policies.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsArray,
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsIn,
} from 'class-validator';

import { type ContentClass, VALID_CONTENT_CLASSES } from '../../domain/classification.service';

import { BreakoutRuleDto } from './breakout-rule.dto';
import { ContextRequirementsDto } from './context-requirements.dto';
import { GlobalRequirementsDto } from './global-requirements.dto';

/**
 * Homepage config DTO.
 * Homepage-specific policy settings.
 */
export class HomepageConfigDto {
  @ApiProperty({
    description: 'Minimum relevance score for homepage items (0-100)',
    example: 50,
  })
  @IsNumber()
  minRelevanceScore: number;
}

/**
 * Policy config DTO.
 * Complete policy configuration settings.
 */
export class PolicyConfigDto {
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

  @ApiProperty({
    description: 'Blocked country mode',
    example: 'ANY',
    enum: ['ANY', 'MAJORITY'],
  })
  @IsEnum(['ANY', 'MAJORITY'])
  blockedCountryMode: 'ANY' | 'MAJORITY';

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

  @ApiProperty({
    description: 'Global streaming providers',
    example: ['netflix', 'max', 'appletv', 'prime', 'disney'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  globalProviders: string[];

  @ApiProperty({
    description: 'Breakout rules for exceptions',
    type: [BreakoutRuleDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BreakoutRuleDto)
  breakoutRules: BreakoutRuleDto[];

  @ApiProperty({
    description: 'Eligibility mode (STRICT = country AND language, RELAXED = country OR language)',
    example: 'STRICT',
    enum: ['STRICT', 'RELAXED'],
  })
  @IsEnum(['STRICT', 'RELAXED'])
  eligibilityMode: 'STRICT' | 'RELAXED';

  @ApiProperty({
    description: 'Homepage configuration',
    type: HomepageConfigDto,
  })
  @ValidateNested()
  @Type(() => HomepageConfigDto)
  homepage: HomepageConfigDto;

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
    isArray: true,
    enum: ['mainstream', 'anime', 'documentary', 'reality', 'kids'],
  })
  @IsOptional()
  @IsArray()
  @IsIn(VALID_CONTENT_CLASSES, { each: true })
  excludedContentClasses?: ContentClass[];

  @ApiPropertyOptional({
    description: 'Context-specific requirements for display surfaces (readability, overview)',
    type: 'object',
    additionalProperties: { $ref: '#/components/schemas/ContextRequirementsDto' },
    example: {
      trending: { requireReadableTitle: true, requireOverview: true, minOverviewChars: 60 },
      homepage: { requireReadableTitle: true, requireOverview: true, minOverviewChars: 60 },
      catalog: { requireReadableTitle: true },
    },
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ContextRequirementsDto)
  contextRequirements?: Record<string, ContextRequirementsDto>;
}
