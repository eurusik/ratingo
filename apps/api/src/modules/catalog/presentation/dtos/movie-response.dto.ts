import { ApiProperty } from '@nestjs/swagger';
import { MediaBaseDto } from './common.dto';
import { MovieStatus } from '../../../../common/enums/movie-status.enum';
import { ReleaseStatus } from '../../../../common/enums/release-status.enum';
import { CardMetaDto } from '../../../shared/cards/presentation/dtos/card-meta.dto';
import { MovieVerdictDto } from './verdict.dto';

export class MovieResponseDto extends MediaBaseDto {
  @ApiProperty({ example: 120, required: false, nullable: true })
  runtime?: number | null;

  @ApiProperty({ example: 100000000, required: false, nullable: true })
  budget?: number | null;

  @ApiProperty({ example: 500000000, required: false, nullable: true })
  revenue?: number | null;

  @ApiProperty({
    enum: MovieStatus,
    example: MovieStatus.RELEASED,
    description:
      'Movie status: Rumored, Planned, In Production, Post Production, Released, Canceled',
    required: false,
    nullable: true,
  })
  status?: MovieStatus | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  releaseDate: Date | null;

  @ApiProperty({
    type: CardMetaDto,
    required: false,
    nullable: true,
    description: 'Card metadata with badge and CTA info',
  })
  card?: CardMetaDto | null;

  @ApiProperty({
    enum: ReleaseStatus,
    example: ReleaseStatus.IN_THEATERS,
    description: 'Computed release status: upcoming, in_theaters, streaming, new_on_streaming',
    required: false,
    nullable: true,
  })
  releaseStatus?: ReleaseStatus | null;

  @ApiProperty({
    type: MovieVerdictDto,
    required: false,
    nullable: true,
    description: 'Computed verdict for movie details page. Clients use messageKey for i18n lookup.',
  })
  verdict?: MovieVerdictDto | null;
}
