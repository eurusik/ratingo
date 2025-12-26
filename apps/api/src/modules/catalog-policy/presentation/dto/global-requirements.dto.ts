/**
 * Global Requirements DTO
 *
 * Defines minimum quality thresholds for all content.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsArray, IsEnum, IsInt, Min, Max } from 'class-validator';

/**
 * Rating source enum for type safety.
 */
export enum RatingSourceEnum {
  IMDB = 'imdb',
  METACRITIC = 'metacritic',
  RT = 'rt',
  TRAKT = 'trakt',
}

/**
 * Global requirements DTO for API validation.
 * Defines minimum quality thresholds for all content.
 */
export class GlobalRequirementsDto {
  @ApiPropertyOptional({
    description: 'Minimum IMDb votes required (integer)',
    example: 3000,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  minImdbVotes?: number;

  @ApiPropertyOptional({
    description: 'Minimum Trakt votes required (integer)',
    example: 1000,
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  minTraktVotes?: number;

  @ApiPropertyOptional({
    description: 'Minimum quality score normalized (0-1)',
    example: 0.6,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minQualityScoreNormalized?: number;

  @ApiPropertyOptional({
    description: 'At least one of these rating sources must be present',
    example: ['imdb', 'metacritic'],
    enum: RatingSourceEnum,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(RatingSourceEnum, { each: true })
  requireAnyOfRatingsPresent?: RatingSourceEnum[];
}
