import { ApiProperty } from '@nestjs/swagger';

import {
  AVAILABILITY_REGIONS,
  type AvailabilityRegion,
} from '../../../../common/constants/region.constants';
import { ImageDto } from '../../../../common/dtos/image.dto';

export class WatchProviderDto {
  @ApiProperty({ example: 'netflix', description: 'Canonical provider ID' })
  id: string;

  @ApiProperty({
    example: 8,
    description: 'Numeric provider ID (deprecated, use id instead)',
    deprecated: true,
  })
  providerId: number;

  @ApiProperty({ example: 'Netflix' })
  name: string;

  @ApiProperty({ type: ImageDto, required: false, nullable: true })
  logo?: ImageDto | null;

  @ApiProperty({ example: 10, required: false })
  displayPriority?: number;
}

export class AvailabilityDto {
  @ApiProperty({
    example: 'UA',
    enum: [...AVAILABILITY_REGIONS],
    nullable: true,
    description: 'Selected region for watch providers (UA primary, US fallback)',
  })
  region: AvailabilityRegion | null;

  @ApiProperty({
    example: false,
    description: 'True if using US as fallback because UA is not available',
  })
  isFallback: boolean;

  @ApiProperty({ example: 'https://www.themoviedb.org/movie/123/watch?locale=UA', nullable: true })
  link: string | null;

  @ApiProperty({
    type: [WatchProviderDto],
    required: false,
    description: 'Streaming/subscription services (flatrate)',
  })
  stream?: WatchProviderDto[];

  @ApiProperty({ type: [WatchProviderDto], required: false })
  rent?: WatchProviderDto[];

  @ApiProperty({ type: [WatchProviderDto], required: false })
  buy?: WatchProviderDto[];

  @ApiProperty({ type: [WatchProviderDto], required: false })
  ads?: WatchProviderDto[];

  @ApiProperty({ type: [WatchProviderDto], required: false })
  free?: WatchProviderDto[];

  @ApiProperty({
    example: 'svod',
    enum: ['svod', 'tvod_only', 'none'],
    description:
      'Hint for UI: svod = show providers, tvod_only = show "not on subscription" message, none = no data',
  })
  hint: 'svod' | 'tvod_only' | 'none';

  @ApiProperty({
    example: 'https://www.themoviedb.org/movie/123/watch',
    required: false,
    nullable: true,
    description: 'TMDB watch page URL for fallback "View on TMDB" link',
  })
  tmdbWatchUrl?: string | null;
}
