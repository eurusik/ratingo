import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ImageDto, ExternalRatingsDto, RatingoStatsDto } from './common.dto';
import { OffsetPaginationMetaDto } from './pagination.dto';
import { CatalogListQueryDto } from './catalog-list-query.dto';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { CardMetaDto } from '../../../shared/cards/presentation/dtos/card-meta.dto';

export class TrendingShowsQueryDto extends CatalogListQueryDto {}

export class ShowProgressDto {
  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Null for trending list optimization',
  })
  season?: number | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Null for trending list optimization',
  })
  episode?: number | null;

  @ApiProperty({
    required: false,
    nullable: true,
    example: 'S5E2',
    description: 'Null for trending list optimization',
  })
  label?: string | null;

  @ApiProperty({ required: false, nullable: true })
  lastAirDate: Date | null;

  @ApiProperty({ required: false, nullable: true })
  nextAirDate: Date | null;
}

export class ShowTrendingItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: MediaType.SHOW, enum: [MediaType.SHOW] })
  type: MediaType.SHOW;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false, nullable: true })
  originalTitle?: string | null;

  @ApiProperty({ required: false, nullable: true })
  overview?: string | null;

  @ApiProperty({ required: false, nullable: true })
  primaryTrailerKey?: string | null;

  @ApiProperty({ type: ImageDto, required: false, nullable: true })
  poster?: ImageDto | null;

  @ApiProperty({ type: ImageDto, required: false, nullable: true })
  backdrop?: ImageDto | null;

  @ApiProperty({ required: false, nullable: true })
  releaseDate: Date | null;

  @ApiProperty()
  isNew: boolean;

  @ApiProperty()
  isClassic: boolean;

  @ApiProperty({ type: RatingoStatsDto })
  stats: RatingoStatsDto;

  @ApiProperty({ type: ExternalRatingsDto })
  externalRatings: ExternalRatingsDto;

  @ApiProperty({ type: ShowProgressDto, required: false, nullable: true })
  showProgress?: ShowProgressDto | null;

  @ApiPropertyOptional({ type: CardMetaDto, required: false })
  card?: CardMetaDto;
}

export class TrendingShowsResponseDto {
  @ApiProperty({ type: [ShowTrendingItemDto] })
  data: ShowTrendingItemDto[];

  @ApiProperty({ type: OffsetPaginationMetaDto })
  meta: OffsetPaginationMetaDto;
}

export class MovieTrendingItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: MediaType.MOVIE, enum: [MediaType.MOVIE] })
  type: MediaType.MOVIE;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false, nullable: true })
  originalTitle?: string | null;

  @ApiProperty({ required: false, nullable: true })
  overview?: string | null;

  @ApiProperty({ required: false, nullable: true })
  primaryTrailerKey?: string | null;

  @ApiProperty({ type: ImageDto, required: false, nullable: true })
  poster?: ImageDto | null;

  @ApiProperty({ type: ImageDto, required: false, nullable: true })
  backdrop?: ImageDto | null;

  @ApiProperty({ required: false, nullable: true })
  releaseDate: Date | null;

  @ApiProperty()
  isNew: boolean;

  @ApiProperty()
  isClassic: boolean;

  @ApiProperty({ type: RatingoStatsDto })
  stats: RatingoStatsDto;

  @ApiProperty({ type: ExternalRatingsDto })
  externalRatings: ExternalRatingsDto;
}

export class TrendingMoviesResponseDto {
  @ApiProperty({ type: [MovieTrendingItemDto] })
  data: MovieTrendingItemDto[];

  @ApiProperty({ type: OffsetPaginationMetaDto })
  meta: OffsetPaginationMetaDto;
}
