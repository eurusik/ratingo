import { ApiProperty } from '@nestjs/swagger';

/**
 * Ratingo platform statistics DTO.
 * Used across modules for displaying platform-specific metrics.
 */
export class RatingoStatsDto {
  @ApiProperty({
    example: 85.5,
    description: 'Composite Ratingo Score (0-100)',
    required: false,
    nullable: true,
  })
  ratingoScore?: number | null;

  @ApiProperty({
    example: 88.5,
    description: 'Quality Score (0-100)',
    required: false,
    nullable: true,
  })
  qualityScore?: number | null;

  @ApiProperty({
    example: 45.2,
    description: 'Popularity Score (0-100)',
    required: false,
    nullable: true,
  })
  popularityScore?: number | null;

  @ApiProperty({
    example: 6,
    description: 'Number of people watching right now (Live)',
    required: false,
    nullable: true,
  })
  liveWatchers?: number | null;

  @ApiProperty({
    example: 6423,
    description: 'Total unique watchers all time',
    required: false,
    nullable: true,
  })
  totalWatchers?: number | null;

  @ApiProperty({
    example: 78.5,
    description: 'Community average rating (0-100 scale)',
    required: false,
    nullable: true,
  })
  communityAverageRating?: number | null;

  @ApiProperty({
    example: 1240,
    description: 'Number of community ratings',
    required: false,
    nullable: true,
  })
  communityRatingCount?: number | null;
}
