import { ApiProperty } from '@nestjs/swagger';
import { MediaBaseDto } from './common.dto';
import { ShowStatus } from '../../../../common/enums/show-status.enum';
import { CardMetaDto } from '../../../shared/cards/presentation/dtos/card-meta.dto';
import { ShowVerdictDto, ShowStatusHintDto } from './verdict.dto';

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
}

export class ShowResponseDto extends MediaBaseDto {
  @ApiProperty({
    type: Date,
    required: false,
    nullable: true,
    description: 'First air date of the show',
  })
  releaseDate?: Date | null;

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
