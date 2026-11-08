import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { OffsetPaginationMetaDto } from '@/common/dtos';
import { ExternalRatingsDto } from '@/common/dtos/external-ratings.dto';
import { ImageDto } from '@/common/dtos/image.dto';
import { RatingoStatsDto } from '@/common/dtos/ratingo-stats.dto';
import { MediaType } from '@/common/enums/media-type.enum';
import { CardMetaDto } from '@/modules/shared/cards';

import { CatalogListQueryDto } from './catalog-list-query.dto';

export class TrendingShowsQueryDto extends CatalogListQueryDto {}

export class ShowProgressDto {
  @ApiProperty({
    type: Number,
    required: false,
    nullable: true,
    description: 'Null for trending list optimization',
  })
  season?: number | null;

  @ApiProperty({
    type: Number,
    required: false,
    nullable: true,
    description: 'Null for trending list optimization',
  })
  episode?: number | null;

  @ApiProperty({
    type: String,
    required: false,
    nullable: true,
    example: 'S5E2',
    description: 'Null for trending list optimization',
  })
  label?: string | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  lastAirDate: Date | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
  nextAirDate: Date | null;
}

class TrendingItemBaseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  mediaItemId: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ type: String, required: false, nullable: true })
  originalTitle?: string | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  overview?: string | null;

  @ApiProperty({ type: String, required: false, nullable: true })
  primaryTrailerKey?: string | null;

  @ApiProperty({ type: ImageDto, required: false, nullable: true })
  poster?: ImageDto | null;

  @ApiProperty({ type: ImageDto, required: false, nullable: true })
  backdrop?: ImageDto | null;

  @ApiProperty({ type: Date, required: false, nullable: true })
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

export class ShowTrendingItemDto extends TrendingItemBaseDto {
  @ApiProperty({ example: MediaType.SHOW, enum: [MediaType.SHOW] })
  type: MediaType.SHOW;

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
