import { ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants';

/**
 * Offset-based pagination query parameters.
 * Used across all listing endpoints.
 */
export class OffsetPaginationQueryDto {
  @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  @Type(() => Number)
  limit?: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}

/**
 * Offset-based pagination metadata for responses.
 */
export class OffsetPaginationMetaDto {
  @ApiPropertyOptional({ example: 100 })
  count!: number;

  @ApiPropertyOptional({ example: 250 })
  total?: number;

  @ApiPropertyOptional({ example: 20 })
  limit!: number;

  @ApiPropertyOptional({ example: 0 })
  offset!: number;

  @ApiPropertyOptional({ example: true })
  hasMore?: boolean;
}

/**
 * Pagination metadata interface (for internal use).
 */
export interface OffsetPaginationMeta {
  count: number;
  total?: number;
  limit: number;
  offset: number;
  hasMore?: boolean;
}

/**
 * Listing sort options.
 */
export const LISTING_SORT = {
  POPULARITY: 'popularity',
  RELEASE_DATE: 'releaseDate',
} as const;

export type ListingSort = (typeof LISTING_SORT)[keyof typeof LISTING_SORT];
export const LISTING_SORT_VALUES = Object.values(LISTING_SORT);
