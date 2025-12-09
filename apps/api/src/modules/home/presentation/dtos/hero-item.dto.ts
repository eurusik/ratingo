import { ApiProperty } from '@nestjs/swagger';
import { ImageDto } from '../../../catalog/presentation/dtos/common.dto';
import { MediaType } from '../../../../common/enums/media-type.enum';

export class HeroStatsDto {
  @ApiProperty({ example: 85.5 })
  ratingoScore: number;

  @ApiProperty({ example: 88.5 })
  qualityScore: number;
}

export class HeroExternalRatingsDto {
  @ApiProperty({ example: { rating: 8.4, voteCount: 20000 }, required: false })
  tmdb?: { rating: number; voteCount?: number };
}

export class HeroItemDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: MediaType.MOVIE, enum: MediaType })
  type: MediaType;

  @ApiProperty({ example: 'fight-club' })
  slug: string;

  @ApiProperty({ example: 'Fight Club' })
  title: string;

  @ApiProperty({ example: 'Fight Club' })
  originalTitle: string;

  @ApiProperty({ example: 'ogFrkWefoLQ', description: 'YouTube video key for primary trailer', required: false, nullable: true })
  primaryTrailerKey?: string | null;

  @ApiProperty({ type: ImageDto })
  poster: ImageDto;

  @ApiProperty({ type: ImageDto })
  backdrop: ImageDto;

  @ApiProperty({ type: HeroStatsDto })
  stats: HeroStatsDto;

  @ApiProperty({ type: HeroExternalRatingsDto, required: false })
  externalRatings?: HeroExternalRatingsDto;

  @ApiProperty({ example: '1999-10-15T00:00:00.000Z' })
  releaseDate: Date | null;

  @ApiProperty({ example: false, description: 'True if released within last 90 days' })
  isNew: boolean;

  @ApiProperty({ example: true, description: 'True if released more than 5 years ago' })
  isClassic: boolean;
}
