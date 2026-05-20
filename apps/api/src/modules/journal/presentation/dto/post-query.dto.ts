import { ApiPropertyOptional } from '@nestjs/swagger';

import { Transform, Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import {
  JOURNAL_DEFAULT_PAGE_SIZE,
  JOURNAL_MAX_PAGE_SIZE,
} from '../../domain/constants/pagination';
import { POST_TYPE_VALUES, PostType } from '../../domain/constants/post-types';

/**
 * Query DTO for public journal posts listing.
 * Supports filtering by type (comma-separated for multi-type) and pagination.
 */
export class PostQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by post type(s). Comma-separated for multiple types (union).',
    example: 'update,fix',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    return String(value)
      .split(',')
      .map((t) => t.trim());
  })
  @IsArray()
  @IsIn(POST_TYPE_VALUES, { each: true })
  type?: PostType[];

  @ApiPropertyOptional({
    description: 'Filter by context identifier',
    example: 'trending',
  })
  @IsOptional()
  @IsString()
  context?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of posts per page',
    example: 10,
    default: JOURNAL_DEFAULT_PAGE_SIZE,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(JOURNAL_MAX_PAGE_SIZE)
  @Type(() => Number)
  limit?: number = JOURNAL_DEFAULT_PAGE_SIZE;
}

/**
 * Query DTO for admin journal posts listing.
 * Adds status filter for draft/published posts.
 */
export class AdminPostQueryDto extends PostQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by post status',
    enum: ['draft', 'published', 'scheduled'],
    example: 'draft',
  })
  @IsOptional()
  @IsIn(['draft', 'published', 'scheduled'])
  status?: 'draft' | 'published' | 'scheduled';
}
