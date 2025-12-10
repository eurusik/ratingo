import { ApiProperty } from '@nestjs/swagger';
import { ImageDto } from './common.dto';

export enum SearchSource {
  LOCAL = 'local',
  TMDB = 'tmdb',
}

export class SearchItemDto {
  @ApiProperty({ enum: SearchSource })
  source: SearchSource;

  @ApiProperty({ example: 'movie', enum: ['movie', 'show'] })
  type: 'movie' | 'show';

  @ApiProperty({ required: false })
  id?: string;

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
  
  @ApiProperty({ example: false, description: 'If true, this TMDB item already exists in local DB' })
  isImported?: boolean;
}

export class SearchResponseDto {
  @ApiProperty()
  query: string;

  @ApiProperty({ type: [SearchItemDto] })
  local: SearchItemDto[];

  @ApiProperty({ type: [SearchItemDto] })
  tmdb: SearchItemDto[];
}
