import { ApiProperty } from '@nestjs/swagger';

import { ExternalRatingsDto } from '../../../../common/dtos/external-ratings.dto';
import { ImageDto } from '../../../../common/dtos/image.dto';
import { RatingoStatsDto } from '../../../../common/dtos/ratingo-stats.dto';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';

import { AvailabilityDto } from './availability.dto';
import { CreditsDto } from './credits.dto';
import { GenreDto } from './genre.dto';
import { UserMediaStateDto } from './user-media-state.dto';
import { VideoDto } from './video.dto';

export class MediaBaseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 12345 })
  tmdbId: number;

  @ApiProperty({ example: 'The Matrix' })
  title: string;

  @ApiProperty({ example: 'The Matrix', required: false, nullable: true })
  originalTitle?: string | null;

  @ApiProperty({ example: 'the-matrix' })
  slug: string;

  @ApiProperty({ example: 'Overview text...', required: false, nullable: true })
  overview?: string | null;

  @ApiProperty({
    example: '/path/to/poster.jpg',
    required: false,
    nullable: true,
    deprecated: true,
  })
  posterPath?: string | null;

  @ApiProperty({ type: ImageDto, required: false, nullable: true })
  poster?: ImageDto | null;

  @ApiProperty({
    example: '/path/to/backdrop.jpg',
    required: false,
    nullable: true,
    deprecated: true,
  })
  backdropPath?: string | null;

  @ApiProperty({ type: ImageDto, required: false, nullable: true })
  backdrop?: ImageDto | null;

  @ApiProperty({ type: RatingoStatsDto, required: false, nullable: true })
  stats?: RatingoStatsDto | null;

  @ApiProperty({ type: ExternalRatingsDto, required: false, nullable: true })
  externalRatings?: ExternalRatingsDto | null;

  @ApiProperty({ type: [GenreDto], required: false })
  genres?: GenreDto[];

  @ApiProperty({ enum: IngestionStatus, example: IngestionStatus.READY })
  ingestionStatus: IngestionStatus;

  @ApiProperty({
    description: 'User-specific state, present only when authenticated',
    required: false,
    nullable: true,
    type: () => UserMediaStateDto,
  })
  userState?: UserMediaStateDto | null;

  @ApiProperty({ type: [VideoDto], required: false, nullable: true })
  videos?: VideoDto[] | null;

  @ApiProperty({
    type: VideoDto,
    required: false,
    nullable: true,
    description: 'Primary trailer (first UK or EN trailer)',
  })
  primaryTrailer?: VideoDto | null;

  @ApiProperty({ type: CreditsDto, required: false, nullable: true })
  credits?: CreditsDto | null;

  @ApiProperty({
    type: AvailabilityDto,
    required: false,
    nullable: true,
    description: 'Where to watch - UA primary with US fallback',
  })
  availability?: AvailabilityDto | null;
}
