import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { REVIEW_LIMITS } from '../../domain/constants/review.constants';

/**
 * DTO for creating a new review.
 */
export class CreateReviewDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Media item UUID',
  })
  @IsUUID()
  mediaItemId: string;

  @ApiProperty({
    example: 'Чудовий фільм! Візуальні ефекти на висоті.',
    description: `Review content (max ${REVIEW_LIMITS.MAX_CONTENT_LENGTH} characters)`,
    maxLength: REVIEW_LIMITS.MAX_CONTENT_LENGTH,
  })
  @IsString()
  @MaxLength(REVIEW_LIMITS.MAX_CONTENT_LENGTH)
  content: string;

  @ApiProperty({
    example: 85,
    description: `Rating from ${REVIEW_LIMITS.MIN_RATING} to ${REVIEW_LIMITS.MAX_RATING}`,
    minimum: REVIEW_LIMITS.MIN_RATING,
    maximum: REVIEW_LIMITS.MAX_RATING,
  })
  @IsInt()
  @Min(REVIEW_LIMITS.MIN_RATING)
  @Max(REVIEW_LIMITS.MAX_RATING)
  rating: number;

  @ApiProperty({
    example: false,
    required: false,
    default: false,
    description: 'Whether the review contains spoilers',
  })
  @IsOptional()
  @IsBoolean()
  hasSpoiler?: boolean;

  @ApiPropertyOptional({
    enum: MediaType,
    example: MediaType.MOVIE,
    description:
      'Media type hint. When provided, allows the correct default user-media state ' +
      'to be chosen for first-time entries (watching for shows, completed for movies).',
  })
  @IsOptional()
  @IsEnum(MediaType)
  mediaType?: MediaType;
}
