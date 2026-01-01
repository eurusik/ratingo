import { ApiProperty } from '@nestjs/swagger';

import { ExternalRatingsDto } from '../../../../common/dtos/external-ratings.dto';
import { ImageDto } from '../../../../common/dtos/image.dto';
import { RatingoStatsDto } from '../../../../common/dtos/ratingo-stats.dto';
import { MediaType } from '../../../../common/enums/media-type.enum';

/**
 * Show progress DTO for TV shows.
 */
export class HeroShowProgressDto {
  @ApiProperty({ example: 5 })
  season: number;

  @ApiProperty({ example: 5 })
  episode: number;

  @ApiProperty({ example: 'S5E5' })
  label: string;

  @ApiProperty({ example: '2025-12-14T00:00:00.000Z', required: false })
  lastAirDate?: Date;

  @ApiProperty({ example: '2025-12-21T00:00:00.000Z', required: false })
  nextAirDate?: Date;
}

/**
 * Hero item DTO for homepage hero block.
 */
export class HeroItemDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  mediaItemId: string;

  @ApiProperty({ example: MediaType.MOVIE, enum: MediaType })
  type: MediaType;

  @ApiProperty({ example: 'fight-club' })
  slug: string;

  @ApiProperty({ example: 'Fight Club' })
  title: string;

  @ApiProperty({ example: 'Fight Club' })
  originalTitle: string;

  @ApiProperty({
    example:
      'An insomniac office worker and a devil-may-care soap maker form an underground fight club that evolves into much more.',
    nullable: true,
  })
  overview: string | null;

  @ApiProperty({
    example: 'ogFrkWefoLQ',
    description: 'YouTube video key for primary trailer',
    required: false,
    nullable: true,
  })
  primaryTrailerKey?: string | null;

  @ApiProperty({ type: ImageDto })
  poster: ImageDto;

  @ApiProperty({ type: ImageDto })
  backdrop: ImageDto;

  @ApiProperty({ type: RatingoStatsDto })
  stats: RatingoStatsDto;

  @ApiProperty({ type: ExternalRatingsDto, required: false })
  externalRatings?: ExternalRatingsDto;

  @ApiProperty({ example: '1999-10-15T00:00:00.000Z', nullable: true })
  releaseDate: Date | null;

  @ApiProperty({ example: false, description: 'True if released within last 90 days' })
  isNew: boolean;

  @ApiProperty({ example: true, description: 'True if released more than 5 years ago' })
  isClassic: boolean;

  @ApiProperty({
    type: HeroShowProgressDto,
    description: 'Progress info for TV Shows (latest aired episode)',
    required: false,
  })
  showProgress?: HeroShowProgressDto;
}
