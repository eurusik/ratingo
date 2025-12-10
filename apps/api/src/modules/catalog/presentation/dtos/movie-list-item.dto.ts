import { ApiProperty } from '@nestjs/swagger';
import { ImageDto, ExternalRatingsDto, RatingoStatsDto, GenreDto } from './common.dto';

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

  @ApiProperty({ nullable: true })
  overview: string | null;

  @ApiProperty({ type: ImageDto, required: false, nullable: true })
  poster?: ImageDto | null;

  @ApiProperty({ type: ImageDto, required: false, nullable: true })
  backdrop?: ImageDto | null;

  @ApiProperty({ example: 120.5 })
  popularity: number;

  @ApiProperty({ nullable: true })
  releaseDate: Date | null;

  @ApiProperty({ nullable: true })
  theatricalReleaseDate: Date | null;

  @ApiProperty({ nullable: true })
  digitalReleaseDate: Date | null;

  @ApiProperty({ nullable: true })
  runtime: number | null;

  @ApiProperty({ type: RatingoStatsDto })
  stats: RatingoStatsDto;

  @ApiProperty({ type: ExternalRatingsDto })
  externalRatings: ExternalRatingsDto;

  @ApiProperty({ type: [GenreDto] })
  genres: GenreDto[];
}
