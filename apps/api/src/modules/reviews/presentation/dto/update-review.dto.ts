import { ApiProperty } from '@nestjs/swagger';

import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import { REVIEW_LIMITS } from '../../domain/constants/review.constants';

/**
 * DTO for updating an existing review.
 */
export class UpdateReviewDto {
  @ApiProperty({
    example: 'Переглянув ще раз - стало ще краще!',
    description: `Updated review content (max ${REVIEW_LIMITS.MAX_CONTENT_LENGTH} characters)`,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(REVIEW_LIMITS.MAX_CONTENT_LENGTH)
  content?: string;

  @ApiProperty({
    example: 90,
    description: `Updated rating from ${REVIEW_LIMITS.MIN_RATING} to ${REVIEW_LIMITS.MAX_RATING}`,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(REVIEW_LIMITS.MIN_RATING)
  @Max(REVIEW_LIMITS.MAX_RATING)
  rating?: number;

  @ApiProperty({
    example: true,
    required: false,
    description: 'Whether the review contains spoilers',
  })
  @IsOptional()
  @IsBoolean()
  hasSpoiler?: boolean;
}
