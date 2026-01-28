/**
 * Global Requirements DTO
 *
 * Defines minimum quality thresholds for all content.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
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

import {
  type EvaluationContext,
  type RatingSource,
  type VoteSource,
} from '../../domain/types/policy.types';

/** Valid rating sources for validation */
const RATING_SOURCES: RatingSource[] = ['imdb', 'metacritic', 'rt', 'trakt'];

/** Valid vote sources for validation */
const VOTE_SOURCES: VoteSource[] = ['imdb', 'trakt'];

/** Valid evaluation contexts for validation */
const EVALUATION_CONTEXTS: EvaluationContext[] = [
  'catalog',
  'homepage',
  'trending',
  'now_playing',
  'new_digital',
  'search',
];

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
 * Local maturity override configuration DTO.
 * Alternative path for fresh content with strong local platform engagement.
 */
export class LocalMaturityOverrideDto {
  @ApiPropertyOptional({
    description:
      'Minimum freshness score normalized (0-1). ' +
      'Higher values = stricter freshness requirement. ' +
      'Example: 0.90 = must be in top 10% freshest content.',
    example: 0.9,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  minFreshnessScoreNormalized: number;

  @ApiPropertyOptional({
    description:
      'Minimum Ratingo platform watchers count. ' +
      'Validates local engagement signal. ' +
      'Example: 30 = at least 30 users actively watching on platform.',
    example: 30,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  minLocalWatchers: number;
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

  @ApiPropertyOptional({
    description:
      'Contexts where global gate applies. ' +
      "Defaults to ['catalog', 'homepage', 'trending', 'search'] if not specified. " +
      'Freshness surfaces (now_playing, new_digital) are excluded by default.',
    example: ['catalog', 'homepage', 'trending', 'search'],
    enum: EVALUATION_CONTEXTS,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsIn(EVALUATION_CONTEXTS, { each: true })
  appliesTo?: EvaluationContext[];

  @ApiPropertyOptional({
    description:
      'Alternative path for fresh content with local engagement. ' +
      'Applied only when minVotesAnyOf check fails. ' +
      'Allows new releases with strong platform signals to bypass vote requirements.',
    type: LocalMaturityOverrideDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocalMaturityOverrideDto)
  localMaturityOverride?: LocalMaturityOverrideDto;
}
