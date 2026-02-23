import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { ImageDto } from '@/common/dtos/image.dto';
import { MediaType } from '@/common/enums/media-type.enum';

export class SearchItemDto {
  @ApiProperty({ enum: ['local', 'tmdb'] })
  source: 'local' | 'tmdb';

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
    description: 'If true, this item exists in local DB',
  })
  isImported: boolean;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Alternative title that matched the search query',
  })
  matchedAlternativeTitle?: string | null;
}

export class SearchResponseDto {
  @ApiProperty()
  query: string;

  @ApiProperty({ type: [SearchItemDto] })
  local: SearchItemDto[];

  @ApiProperty({ type: [SearchItemDto] })
  tmdb: SearchItemDto[];
}
