import { ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  Validate,
} from 'class-validator';

import { DEFAULT_PAGE_SIZE } from '../../../../common/constants';
import {
  CATALOG_SORT,
  CATALOG_SORT_VALUES,
  type CatalogSort,
  SORT_ORDER,
  type SortOrder,
  VOTE_SOURCE,
  type VoteSource,
} from '../../domain/constants/catalog-query.constants';
import { LIST_CONTEXT } from '../../domain/constants/catalog.constants';
import type { ListContext } from '../../domain/types/query.types';
import { YearExclusiveConstraint, YearRangeConstraint } from '../validators/year-range.validator';

const LIST_CONTEXT_VALUES = Object.values(LIST_CONTEXT);

/**
 * Unified list query parameters for catalog endpoints.
 */
export class CatalogListQueryDto {
  @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset: number = 0;

  @ApiPropertyOptional({
    enum: CATALOG_SORT_VALUES,
    default: CATALOG_SORT.TRENDING,
    description:
      'trending = TMDB trending order; popularity = aggregated popularity_score; tmdbPopularity = raw TMDB popularity; ratingo = ratingoScore; releaseDate = premiere/theatrical release date; lastAirDate = most recent episode air date (shows only, falls back to releaseDate)',
  })
  @IsOptional()
  @IsIn(CATALOG_SORT_VALUES)
  sort: CatalogSort = CATALOG_SORT.TRENDING;

  @ApiPropertyOptional({
    enum: SORT_ORDER,
    default: SORT_ORDER.DESC,
  })
  @IsOptional()
  @IsEnum(SORT_ORDER)
  order: SortOrder = SORT_ORDER.DESC;

  @ApiPropertyOptional({
    description: 'Comma-separated genre slugs (OR logic), e.g. "komediya,zhakhy"',
  })
  @IsOptional()
  @IsString()
  genres?: string;

  @ApiPropertyOptional({ description: 'Min ratingoScore (0-100)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  minRatingo?: number;

  @ApiPropertyOptional({
    description: 'Vote source for minVotes filter',
    enum: VOTE_SOURCE,
    default: VOTE_SOURCE.TMDB,
  })
  @IsOptional()
  @IsEnum(VOTE_SOURCE)
  voteSource: VoteSource = VOTE_SOURCE.TMDB;

  @ApiPropertyOptional({ description: 'Min votes for selected voteSource', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  minVotes?: number;

  @ApiPropertyOptional({ description: 'Release year (shortcut)' })
  @IsOptional()
  @Validate(YearExclusiveConstraint)
  @IsInt()
  @Min(1900)
  @Max(2100)
  @Type(() => Number)
  year?: number;

  @ApiPropertyOptional({ description: 'Release year from (inclusive)' })
  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  @Type(() => Number)
  yearFrom?: number;

  @ApiPropertyOptional({ description: 'Release year to (inclusive)' })
  @IsOptional()
  @Validate(YearRangeConstraint)
  @IsInt()
  @Min(1900)
  @Max(2100)
  @Type(() => Number)
  yearTo?: number;

  @ApiPropertyOptional({
    enum: LIST_CONTEXT_VALUES,
    default: LIST_CONTEXT.CATALOG,
    description: 'List context: home = stricter freshness filtering; catalog = permissive',
  })
  @IsOptional()
  @IsIn(LIST_CONTEXT_VALUES)
  context: ListContext = LIST_CONTEXT.CATALOG;
}
