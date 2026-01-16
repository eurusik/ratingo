import { ApiProperty } from '@nestjs/swagger';

import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

import {
  REVIEW_SORT,
  REVIEW_SORT_VALUES,
  type ReviewSort,
} from '../../domain/constants/review.constants';

/**
 * Query DTO for listing reviews.
 */
export class ReviewQueryDto {
  @ApiProperty({
    enum: REVIEW_SORT_VALUES,
    example: REVIEW_SORT.NEWEST,
    required: false,
    default: REVIEW_SORT.NEWEST,
    description: 'Sort order: newest, oldest, or most_liked',
  })
  @IsOptional()
  @IsIn(REVIEW_SORT_VALUES)
  sort?: ReviewSort;

  @ApiProperty({
    example: 20,
    required: false,
    default: 20,
    minimum: 1,
    maximum: 100,
    description: 'Number of reviews to return',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({
    example: 0,
    required: false,
    default: 0,
    minimum: 0,
    description: 'Offset for pagination',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @ApiProperty({
    example: false,
    required: false,
    default: false,
    description: 'Hide reviews marked as spoilers',
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hideSpoilers?: boolean;
}
