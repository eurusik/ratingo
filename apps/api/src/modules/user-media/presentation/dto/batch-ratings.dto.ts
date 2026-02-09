import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsUUID } from 'class-validator';

import { MAX_PAGE_SIZE } from '../../../../common/constants';

/**
 * Query DTO for batch ratings lookup.
 *
 * Accepts a comma-separated string of UUIDs via query parameter,
 * transforms it into a validated `string[]` of UUIDv4 values.
 */
export class BatchRatingsQueryDto {
  @ApiProperty({
    description: `Comma-separated media item UUIDs (max ${MAX_PAGE_SIZE})`,
    example: '550e8400-e29b-41d4-a716-446655440000,7c9e6679-7425-40de-944b-e07fc1f90ae7',
    type: 'string',
  })
  @Transform(({ value }) =>
    String(value)
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, MAX_PAGE_SIZE),
  )
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PAGE_SIZE)
  @IsUUID('4', { each: true })
  ids!: string[];
}

/**
 * Response DTO for batch ratings.
 * Key = mediaItemId, Value = rating (0-100).
 */
export class BatchRatingsResponseDto {
  @ApiProperty({
    description: 'Map of mediaItemId to user rating (0-100). Only includes items with ratings.',
    example: { 'uuid-1': 85, 'uuid-2': 60 },
    type: 'object',
    additionalProperties: { type: 'number' },
  })
  ratings!: Record<string, number>;
}
