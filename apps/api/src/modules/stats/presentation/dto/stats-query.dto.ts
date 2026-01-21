import { ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Query DTO for backfill total watchers endpoint.
 * Validates and transforms query parameters.
 */
export class BackfillTotalWatchersQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by media type',
    enum: ['movie', 'show'],
    example: 'show',
  })
  @IsOptional()
  @IsIn(['movie', 'show'])
  type?: 'movie' | 'show';

  @ApiPropertyOptional({
    description: 'Max items to backfill',
    example: 100,
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 100;

  @ApiPropertyOptional({
    description: 'Minimum Trakt votes to consider item as corrupted',
    example: 100,
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minVotes?: number = 100;
}

/**
 * Query DTO for backfill watchers count endpoint.
 * Validates and transforms query parameters.
 */
export class BackfillWatchersCountQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by media type',
    enum: ['movie', 'show'],
    example: 'show',
  })
  @IsOptional()
  @IsIn(['movie', 'show'])
  type?: 'movie' | 'show';

  @ApiPropertyOptional({
    description: 'Max items to backfill',
    example: 100,
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 100;

  @ApiPropertyOptional({
    description: 'Minimum total_watchers to consider item as corrupted',
    example: 100,
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minTotalWatchers?: number = 100;
}

/**
 * Query DTO for score recalculation endpoint.
 * Validates and transforms query parameters.
 */
export class RecalculateScoresQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by media type',
    enum: ['movie', 'show'],
    example: 'show',
  })
  @IsOptional()
  @IsIn(['movie', 'show'])
  type?: 'movie' | 'show';

  @ApiPropertyOptional({
    description: 'Number of items per batch',
    example: 100,
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  batchSize?: number = 100;
}

/**
 * Query DTO for sync trending stats endpoint.
 */
export class SyncTrendingQueryDto {
  @ApiPropertyOptional({
    description: 'Number of trending items to sync per type (movies + shows)',
    example: 100,
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 100;
}

/**
 * Query DTO for drop-off analysis endpoint.
 */
export class AnalyzeDropOffQueryDto {
  @ApiPropertyOptional({
    description: 'TMDB ID of specific show to analyze',
    example: 12345,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tmdbId?: number;

  @ApiPropertyOptional({
    description: 'Max shows to analyze',
    example: 50,
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
