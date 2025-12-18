import { ApiProperty } from '@nestjs/swagger';
import { ImageDto } from './common.dto';
import { MediaType } from '../../../../common/enums/media-type.enum';

export enum SearchSource {
  LOCAL = 'local',
  TMDB = 'tmdb',
}

export class SearchItemDto {
  @ApiProperty({ enum: SearchSource })
  source: SearchSource;

  @ApiProperty({ enum: MediaType })
  type: MediaType;

  @ApiProperty({ required: false })
  id?: string;

  @ApiProperty({ required: false })
  mediaItemId?: string;

  @ApiProperty({ required: false })
  slug?: string;

  @ApiProperty()
  tmdbId: number;

  @ApiProperty()
  title: string;

  @ApiProperty({ required: false, nullable: true })
  originalTitle?: string | null;

  @ApiProperty({ required: false, nullable: true })
  year?: number | null;

  @ApiProperty({ type: ImageDto, required: false, nullable: true })
  poster?: ImageDto | null;

  @ApiProperty({ example: 8.5 })
  rating: number;

  @ApiProperty({
    example: false,
    description: 'If true, this TMDB item already exists in local DB',
  })
  isImported?: boolean;

  @ApiProperty({
    example: true,
    description: 'If false, item has no Ukrainian localization and cannot be imported',
  })
  hasUkrainianLocalization?: boolean;
}

export class SearchResponseDto {
  @ApiProperty()
  query: string;

  @ApiProperty({ type: [SearchItemDto] })
  local: SearchItemDto[];

  @ApiProperty({ type: [SearchItemDto] })
  tmdb: SearchItemDto[];
}
