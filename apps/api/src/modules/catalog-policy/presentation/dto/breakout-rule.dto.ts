/**
 * Breakout Rule DTOs
 *
 * Request DTOs for breakout rule configuration in policies.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsIn,
  IsBoolean,
  Min,
  Max,
  MinLength,
  ValidateNested,
} from 'class-validator';

import {
  RATING_SOURCES,
  type RatingSourceType,
  AVAILABILITY_MODES,
  type AvailabilityModeType,
} from './constants';

/**
 * Breakout rule requirements DTO.
 * Defines conditions that must be met for a breakout rule to apply.
 */
export class BreakoutRuleRequirementsDto {
  @ApiPropertyOptional({
    description: 'Minimum IMDb vote count required',
    example: 10000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minImdbVotes?: number;

  @ApiPropertyOptional({
    description: 'Minimum Trakt vote count required',
    example: 5000,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minTraktVotes?: number;

  @ApiPropertyOptional({
    description: 'Minimum normalized quality score (0.0 to 1.0)',
    example: 0.7,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minQualityScoreNormalized?: number;

  @ApiPropertyOptional({
    description: 'List of streaming providers - at least one must be present',
    example: ['netflix', 'prime', 'disney'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requireAnyOfProviders?: string[];

  @ApiPropertyOptional({
    description:
      'Rating sources - at least one must have a rating present. Valid values: imdb, metacritic, rt, trakt',
    example: ['imdb', 'rt'],
    isArray: true,
    enum: RATING_SOURCES,
  })
  @IsOptional()
  @IsArray()
  @IsIn(RATING_SOURCES, { each: true })
  requireAnyOfRatingsPresent?: RatingSourceType[];

  @ApiPropertyOptional({
    description:
      'Availability mode for provider filtering. subscription_only = flatrate only, transactional_only = rent/buy only, any = all types',
    example: 'subscription_only',
    enum: AVAILABILITY_MODES,
  })
  @IsOptional()
  @IsIn(AVAILABILITY_MODES)
  availabilityMode?: AvailabilityModeType;

  @ApiPropertyOptional({
    description: 'Exclude ads-tier variants from provider matching',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  excludeAdsTiers?: boolean;

  @ApiPropertyOptional({
    description: 'Exclude non-direct distribution channels (amazon_channel, apple_tv_channel)',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  excludeChannelDistribution?: boolean;

  @ApiPropertyOptional({
    description:
      'Origin countries filter (ISO 3166-1 alpha-2 codes). Rule matches if media has ANY of these countries.',
    example: ['UA', 'PL'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  originCountries?: string[];

  @ApiPropertyOptional({
    description:
      'Exclude origin countries filter (ISO 3166-1 alpha-2 codes). Rule does NOT match if media has ANY of these countries.',
    example: ['JP', 'KR', 'CN'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludeOriginCountries?: string[];
}

/**
 * Breakout rule configuration DTO.
 * Allows blocked content to become eligible under specific conditions.
 */
export class BreakoutRuleDto {
  @ApiProperty({
    description: 'Unique identifier for the breakout rule',
    example: 'high-quality-exception',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  id: string;

  @ApiProperty({
    description: 'Human-readable name for the breakout rule',
    example: 'High Quality Content Exception',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({
    description: 'Priority of the rule (lower number = higher priority)',
    example: 1,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  priority: number;

  @ApiProperty({
    description: 'Requirements that must be met for this rule to apply',
    type: BreakoutRuleRequirementsDto,
  })
  @ValidateNested()
  @Type(() => BreakoutRuleRequirementsDto)
  requirements: BreakoutRuleRequirementsDto;
}
