import { ApiProperty } from '@nestjs/swagger';

import { ShowStatus } from '../../../../common/enums/show-status.enum';
import { CardMetaDto } from '../../../shared/cards';

import { MediaBaseDto } from './media-base.dto';
import { ShowVerdictDto, ShowStatusHintDto } from './verdict.dto';

export class EpisodeDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false,
    nullable: true,
    description: 'Internal episode ID (null if not yet imported)',
  })
  id: string | null;

  @ApiProperty({ example: 1 })
  number: number;

  @ApiProperty({ example: 'The Beginning', required: false, nullable: true })
  title: string | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  airDate: Date | null;

  @ApiProperty({ example: 52, required: false, nullable: true })
  runtime: number | null;

  @ApiProperty({ example: '/path/to/still.jpg', required: false, nullable: true })
  stillPath: string | null;

  @ApiProperty({ example: 8.5, required: false, nullable: true })
  voteAverage: number | null;
}

export class SeasonDto {
  @ApiProperty({ example: 1 })
  number: number;

  @ApiProperty({ example: 'Season 1', required: false, nullable: true })
  name: string | null;

  @ApiProperty({ example: 10, required: false, nullable: true })
  episodeCount: number | null;

  @ApiProperty({ example: '/path/to/poster.jpg', required: false, nullable: true })
  posterPath: string | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  airDate: Date | null;

  @ApiProperty({ type: [EpisodeDto], required: false })
  episodes?: EpisodeDto[];
}

export class ShowResponseDto extends MediaBaseDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Internal shows table ID (for episode progress tracking)',
  })
  showId: string;

  @ApiProperty({
    type: Date,
    required: false,
    nullable: true,
    description: 'First air date of the show',
  })
  releaseDate?: Date | null;

  @ApiProperty({
    type: Date,
    required: false,
    nullable: true,
    description: 'When the show metadata was last synced',
  })
  lastSyncedAt?: Date | null;

  @ApiProperty({ example: 5, required: false, nullable: true })
  totalSeasons?: number | null;

  @ApiProperty({ example: 62, required: false, nullable: true })
  totalEpisodes?: number | null;

  @ApiProperty({
    enum: ShowStatus,
    example: ShowStatus.RETURNING_SERIES,
    description: 'Show status: Returning Series, Ended, Canceled, In Production, Planned',
    required: false,
    nullable: true,
  })
  status?: ShowStatus | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  lastAirDate: Date | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  nextAirDate: Date | null;

  @ApiProperty({ type: [SeasonDto] })
  seasons: SeasonDto[];

  @ApiProperty({
    type: CardMetaDto,
    required: false,
    nullable: true,
    description: 'Card metadata with badge and CTA info',
  })
  card?: CardMetaDto | null;

  @ApiProperty({
    type: ShowVerdictDto,
    required: false,
    nullable: true,
    description: 'Show verdict - answers "is it worth it?"',
  })
  verdict?: ShowVerdictDto | null;

  @ApiProperty({
    type: ShowStatusHintDto,
    required: false,
    nullable: true,
    description: 'Status hint - explains "why now?" (secondary, optional)',
  })
  statusHint?: ShowStatusHintDto | null;
}
