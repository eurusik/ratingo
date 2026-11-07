import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ExternalRatingsDto } from '../../../../common/dtos/external-ratings.dto';
import { ImageDto } from '../../../../common/dtos/image.dto';
import { RatingoStatsDto } from '../../../../common/dtos/ratingo-stats.dto';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { CardMetaDto } from '../../../shared/cards';

import { GenreDto } from './genre.dto';

export class MovieListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  mediaItemId: string;

  @ApiProperty()
  tmdbId: number;

  @ApiProperty()
  title: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({
    example: IngestionStatus.READY,
    enum: IngestionStatus,
    default: IngestionStatus.READY,
  })
  ingestionStatus: IngestionStatus;

  @ApiProperty({ type: String, nullable: true })
  overview: string | null;

  @ApiProperty({ type: ImageDto, required: false, nullable: true })
  poster?: ImageDto | null;

  @ApiProperty({ type: ImageDto, required: false, nullable: true })
  backdrop?: ImageDto | null;

  @ApiProperty({ example: 120.5 })
  popularity: number;

  @ApiProperty({ type: Date, nullable: true })
  releaseDate: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  theatricalReleaseDate: Date | null;

  @ApiProperty({ type: Date, nullable: true })
  digitalReleaseDate: Date | null;

  @ApiProperty({ type: Number, nullable: true })
  runtime: number | null;

  @ApiProperty({ type: RatingoStatsDto })
  stats: RatingoStatsDto;

  @ApiProperty({ type: ExternalRatingsDto })
  externalRatings: ExternalRatingsDto;

  @ApiProperty({ type: [GenreDto] })
  genres: GenreDto[];

  @ApiPropertyOptional({ type: CardMetaDto, required: false })
  card?: CardMetaDto;
}
