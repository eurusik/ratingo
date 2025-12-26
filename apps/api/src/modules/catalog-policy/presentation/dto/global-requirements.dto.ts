/**
 * Global Requirements DTO
 *
 * Defines minimum quality thresholds for all content.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumber,
  IsArray,
  IsIn,
  IsInt,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RatingSource, VoteSource } from '../../domain/types/policy.types';

/** Valid rating sources for validation */
const RATING_SOURCES: RatingSource[] = ['imdb', 'metacritic', 'rt', 'trakt'];

/** Valid vote sources for validation */
const VOTE_SOURCES: VoteSource[] = ['imdb', 'trakt'];

/**
 * Min votes any-of configuration DTO.
 */
export class MinVotesAnyOfDto {
  @ApiPropertyOptional({
    description: 'Vote sources to check (OR logic)',
    example: ['imdb', 'trakt'],
    enum: VOTE_SOURCES,
    isArray: true,
  })
  @IsArray()
  @IsIn(VOTE_SOURCES, { each: true })
  sources: VoteSource[];

  @ApiPropertyOptional({
    description: 'Minimum votes threshold',
    example: 3000,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  min: number;
}

/**
 * Global requirements DTO for API validation.
 * Defines minimum quality thresholds for all content.
 */
export class GlobalRequirementsDto {
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
    description: 'At least one of these rating sources must be present (OR logic)',
    example: ['imdb', 'trakt'],
    enum: RATING_SOURCES,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsIn(RATING_SOURCES, { each: true })
  requireAnyOfRatingsPresent?: RatingSource[];

  @ApiPropertyOptional({
    description:
      'Minimum votes from ANY of the specified sources (OR logic). ' +
      'Passes if any source meets the threshold. Robust to missing data.',
    type: MinVotesAnyOfDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => MinVotesAnyOfDto)
  minVotesAnyOf?: MinVotesAnyOfDto;
}
