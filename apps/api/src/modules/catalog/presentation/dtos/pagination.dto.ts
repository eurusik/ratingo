import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const LISTING_SORT = {
  POPULARITY: 'popularity',
  RELEASE_DATE: 'releaseDate',
} as const;
export type ListingSort = (typeof LISTING_SORT)[keyof typeof LISTING_SORT];
export const LISTING_SORT_VALUES = Object.values(LISTING_SORT);

export class OffsetPaginationQueryDto {
  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}

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

export interface OffsetPaginationMeta {
  count: number;
  total?: number;
  limit: number;
  offset: number;
  hasMore?: boolean;
}
