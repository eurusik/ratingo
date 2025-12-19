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
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'YearRange', async: false })
class YearRangeConstraint implements ValidatorConstraintInterface {
  validate(yearTo: any, args: ValidationArguments): boolean {
    const o = args.object as { yearFrom?: number; yearTo?: number };
    if (o.yearFrom === undefined || yearTo === undefined) return true;
    return o.yearFrom <= yearTo;
  }

  defaultMessage(): string {
    return 'yearFrom must be less than or equal to yearTo';
  }
}

@ValidatorConstraint({ name: 'YearExclusive', async: false })
class YearExclusiveConstraint implements ValidatorConstraintInterface {
  validate(year: any, args: ValidationArguments): boolean {
    const o = args.object as { yearFrom?: number; yearTo?: number };
    if (year === undefined) return true;
    return o.yearFrom === undefined && o.yearTo === undefined;
  }

  defaultMessage(): string {
    return 'year cannot be used with yearFrom/yearTo';
  }
}

export const CATALOG_SORT = {
  TRENDING: 'trending',
  POPULARITY: 'popularity',
  RATINGO: 'ratingo',
  RELEASE_DATE: 'releaseDate',
  TMDB_POPULARITY: 'tmdbPopularity',
} as const;
export const CATALOG_SORT_VALUES = Object.values(CATALOG_SORT);
export type CatalogSort = (typeof CATALOG_SORT_VALUES)[number];

export const SORT_ORDER = {
  ASC: 'asc',
  DESC: 'desc',
} as const;
export type SortOrder = (typeof SORT_ORDER)[keyof typeof SORT_ORDER];

export const VOTE_SOURCE = {
  TMDB: 'tmdb',
  TRAKT: 'trakt',
} as const;
export type VoteSource = (typeof VOTE_SOURCE)[keyof typeof VOTE_SOURCE];

/**
 * Unified list query parameters for catalog endpoints.
 */
export class CatalogListQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit: number = 20;

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
      'trending = TMDB trending order; popularity = aggregated popularity_score; tmdbPopularity = raw TMDB popularity; ratingo = ratingoScore',
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
}
