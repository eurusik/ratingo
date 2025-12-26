/**
 * Breakout Rule DTOs
 *
 * Request DTOs for breakout rule configuration in policies.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsIn,
  Min,
  Max,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Valid rating sources for breakout rules.
 */
export const VALID_RATING_SOURCES = ['imdb', 'metacritic', 'rt', 'trakt'] as const;
export type RatingSource = (typeof VALID_RATING_SOURCES)[number];

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
    isArray: true,
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
    enum: VALID_RATING_SOURCES,
  })
  @IsOptional()
  @IsArray()
  @IsIn(VALID_RATING_SOURCES, { each: true })
  requireAnyOfRatingsPresent?: RatingSource[];
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
