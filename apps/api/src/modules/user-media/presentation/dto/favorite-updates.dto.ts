import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { MeUserMediaSummaryDto } from './me-lists.dto';

/**
 * Episode info for favorite update items.
 */
export class EpisodeInfoDto {
  @ApiProperty({ description: 'Season number', example: 2 })
  seasonNumber!: number;

  @ApiProperty({ description: 'Episode number', example: 5 })
  episodeNumber!: number;

  @ApiPropertyOptional({
    description: 'Episode title',
    example: 'The Winds of Winter',
    nullable: true,
  })
  title!: string | null;

  @ApiPropertyOptional({ description: 'Air date', nullable: true })
  airDate!: Date | null;
}

/**
 * A single item in the "Updates for Your Favorites" section.
 */
export class FavoriteUpdateItemDto {
  @ApiProperty({ description: 'Media item ID' })
  mediaItemId!: string;

  @ApiProperty({ description: 'User rating (0-100)', example: 85 })
  rating!: number;

  @ApiProperty({ type: MeUserMediaSummaryDto })
  mediaSummary!: MeUserMediaSummaryDto;

  @ApiPropertyOptional({
    type: EpisodeInfoDto,
    nullable: true,
    description: 'Most recent aired episode',
  })
  latestEpisode!: EpisodeInfoDto | null;

  @ApiPropertyOptional({
    type: EpisodeInfoDto,
    nullable: true,
    description: 'Next upcoming episode',
  })
  nextEpisode!: EpisodeInfoDto | null;
}

/**
 * Response for favorite updates endpoint.
 */
export class FavoriteUpdatesResponseDto {
  @ApiProperty({ type: FavoriteUpdateItemDto, isArray: true })
  data!: FavoriteUpdateItemDto[];
}
