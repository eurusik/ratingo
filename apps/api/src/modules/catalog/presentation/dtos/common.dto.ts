import { ApiProperty } from '@nestjs/swagger';
import {
  VideoSiteEnum,
  VideoTypeEnum,
  VideoLanguageEnum,
} from '../../../../common/enums/video.enum';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';

export class GenreDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Action' })
  name: string;

  @ApiProperty({ example: 'action' })
  slug: string;
}

export class VideoDto {
  @ApiProperty({ example: 'dQw4w9WgXcQ', description: 'YouTube video key' })
  key: string;

  @ApiProperty({ example: 'Dune: Part Two | Official Trailer 3', description: 'Video title' })
  name: string;

  @ApiProperty({ enum: VideoSiteEnum, example: VideoSiteEnum.YOUTUBE })
  site: VideoSiteEnum;

  @ApiProperty({ enum: VideoTypeEnum, example: VideoTypeEnum.TRAILER })
  type: VideoTypeEnum;

  @ApiProperty({ example: true, description: 'Is this an official video' })
  official: boolean;

  @ApiProperty({
    enum: VideoLanguageEnum,
    example: VideoLanguageEnum.EN,
    description: 'ISO 639-1 language code',
  })
  language: VideoLanguageEnum;

  @ApiProperty({ example: 'US', description: 'ISO 3166-1 alpha-2 country code' })
  country: string;
}

export class CastMemberDto {
  @ApiProperty({ example: 'tmdb:123', description: 'Universal person identifier' })
  personId: string;

  @ApiProperty({ example: 'brad-pitt', description: 'URL-friendly slug', nullable: true })
  slug: string | null;

  @ApiProperty({ example: 123, deprecated: true })
  tmdbId: number;

  @ApiProperty({ example: 'Brad Pitt' })
  name: string;

  @ApiProperty({ example: 'Tyler Durden' })
  character: string;

  @ApiProperty({ example: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', nullable: true })
  profilePath: string | null;

  @ApiProperty({ example: 0 })
  order: number;
}

export class CrewMemberDto {
  @ApiProperty({ example: 'tmdb:456', description: 'Universal person identifier' })
  personId: string;

  @ApiProperty({ example: 'david-fincher', description: 'URL-friendly slug', nullable: true })
  slug: string | null;

  @ApiProperty({ example: 456, deprecated: true })
  tmdbId: number;

  @ApiProperty({ example: 'David Fincher' })
  name: string;

  @ApiProperty({ example: 'Director' })
  job: string;

  @ApiProperty({ example: 'Directing' })
  department: string;

  @ApiProperty({ example: '/y.jpg', nullable: true })
  profilePath: string | null;
}

export class CreditsDto {
  @ApiProperty({
    type: [CastMemberDto],
    example: [
      {
        personId: 'tmdb:123',
        slug: 'brad-pitt',
        tmdbId: 123,
        name: 'Brad Pitt',
        character: 'Tyler Durden',
        profilePath: '/brad.jpg',
        order: 0,
      },
    ],
  })
  cast: CastMemberDto[];

  @ApiProperty({
    type: [CrewMemberDto],
    example: [
      {
        personId: 'tmdb:456',
        slug: 'david-fincher',
        tmdbId: 456,
        name: 'David Fincher',
        job: 'Director',
        department: 'Directing',
        profilePath: '/david.jpg',
      },
    ],
  })
  crew: CrewMemberDto[];
}

export class RatingoStatsDto {
  @ApiProperty({
    example: 85.5,
    description: 'Composite Hype Score (0-100)',
    required: false,
    nullable: true,
  })
  ratingoScore?: number | null;

  @ApiProperty({
    example: 88.5,
    description: 'Quality Score (0-100)',
    required: false,
    nullable: true,
  })
  qualityScore?: number | null;

  @ApiProperty({
    example: 45.2,
    description: 'Popularity Score (0-100)',
    required: false,
    nullable: true,
  })
  popularityScore?: number | null;

  @ApiProperty({
    example: 6,
    description: 'Number of people watching right now (Live)',
    required: false,
    nullable: true,
  })
  liveWatchers?: number | null;

  @ApiProperty({
    example: 6423,
    description: 'Total unique watchers all time',
    required: false,
    nullable: true,
  })
  totalWatchers?: number | null;
}

export class UserMediaStateDto {
  @ApiProperty({ enum: ['watching', 'completed', 'planned', 'dropped'], example: 'watching' })
  state: 'watching' | 'completed' | 'planned' | 'dropped';

  @ApiProperty({ example: 85, required: false, nullable: true })
  rating?: number | null;

  @ApiProperty({ required: false, nullable: true })
  progress?: Record<string, unknown> | null;

  @ApiProperty({ example: 'Rewatching with friends', required: false, nullable: true })
  notes?: string | null;
}

export class ExternalRatingItemDto {
  @ApiProperty({ example: 8.8 })
  rating: number;

  @ApiProperty({ example: 2000000, required: false, nullable: true })
  voteCount?: number | null;
}

export class ExternalRatingsDto {
  @ApiProperty({ type: ExternalRatingItemDto, required: false, nullable: true })
  tmdb?: ExternalRatingItemDto | null;

  @ApiProperty({ type: ExternalRatingItemDto, required: false, nullable: true })
  imdb?: ExternalRatingItemDto | null;

  @ApiProperty({ type: ExternalRatingItemDto, required: false, nullable: true })
  trakt?: ExternalRatingItemDto | null;

  @ApiProperty({ type: ExternalRatingItemDto, required: false, nullable: true })
  metacritic?: ExternalRatingItemDto | null;

  @ApiProperty({ type: ExternalRatingItemDto, required: false, nullable: true })
  rottenTomatoes?: ExternalRatingItemDto | null;
}

export class ImageDto {
  @ApiProperty({
    example: 'https://image.tmdb.org/t/p/w342/abc.jpg',
    description: 'Small image for cards (w342)',
  })
  small: string;

  @ApiProperty({
    example: 'https://image.tmdb.org/t/p/w500/abc.jpg',
    description: 'Medium image for details (w500)',
  })
  medium: string;

  @ApiProperty({
    example: 'https://image.tmdb.org/t/p/w780/abc.jpg',
    description: 'Large image for banners (w780)',
  })
  large: string;

  @ApiProperty({
    example: 'https://image.tmdb.org/t/p/original/abc.jpg',
    description: 'Original quality image',
  })
  original: string;
}

export class WatchProviderDto {
  @ApiProperty({ example: 8 })
  providerId: number;

  @ApiProperty({ example: 'Netflix' })
  name: string;

  @ApiProperty({ type: ImageDto, required: false, nullable: true })
  logo?: ImageDto | null;

  @ApiProperty({ example: 10, required: false })
  displayPriority?: number;
}

export class WatchProviderRegionDto {
  @ApiProperty({ example: 'https://www.themoviedb.org/movie/123/watch?locale=UA', nullable: true })
  link: string | null;

  @ApiProperty({ type: [WatchProviderDto], required: false })
  stream?: WatchProviderDto[];

  @ApiProperty({ type: [WatchProviderDto], required: false })
  rent?: WatchProviderDto[];

  @ApiProperty({ type: [WatchProviderDto], required: false })
  buy?: WatchProviderDto[];

  @ApiProperty({ type: [WatchProviderDto], required: false })
  ads?: WatchProviderDto[];

  @ApiProperty({ type: [WatchProviderDto], required: false })
  free?: WatchProviderDto[];
}

export class AvailabilityDto {
  @ApiProperty({
    example: 'UA',
    enum: ['UA', 'US'],
    nullable: true,
    description: 'Selected region for watch providers (UA primary, US fallback)',
  })
  region: 'UA' | 'US' | null;

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
}

export class MediaBaseDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 12345 })
  tmdbId: number;

  @ApiProperty({ example: 'The Matrix' })
  title: string;

  @ApiProperty({ example: 'The Matrix', required: false, nullable: true })
  originalTitle?: string | null;

  @ApiProperty({ example: 'the-matrix' })
  slug: string;

  @ApiProperty({ example: 'Overview text...', required: false, nullable: true })
  overview?: string | null;

  @ApiProperty({
    example: '/path/to/poster.jpg',
    required: false,
    nullable: true,
    deprecated: true,
  })
  posterPath?: string | null;

  @ApiProperty({ type: ImageDto, required: false, nullable: true })
  poster?: ImageDto | null;

  @ApiProperty({
    example: '/path/to/backdrop.jpg',
    required: false,
    nullable: true,
    deprecated: true,
  })
  backdropPath?: string | null;

  @ApiProperty({ type: ImageDto, required: false, nullable: true })
  backdrop?: ImageDto | null;

  @ApiProperty({ type: RatingoStatsDto, required: false, nullable: true })
  stats?: RatingoStatsDto | null;

  @ApiProperty({ type: ExternalRatingsDto, required: false, nullable: true })
  externalRatings?: ExternalRatingsDto | null;

  @ApiProperty({ type: [GenreDto], required: false })
  genres?: GenreDto[];

  @ApiProperty({ enum: IngestionStatus, example: IngestionStatus.READY })
  ingestionStatus: IngestionStatus;

  @ApiProperty({
    description: 'User-specific state, present only when authenticated',
    required: false,
    nullable: true,
    type: () => UserMediaStateDto,
  })
  userState?: UserMediaStateDto | null;

  @ApiProperty({ type: [VideoDto], required: false, nullable: true })
  videos?: VideoDto[] | null;

  @ApiProperty({
    type: VideoDto,
    required: false,
    nullable: true,
    description: 'Primary trailer (first UK or EN trailer)',
  })
  primaryTrailer?: VideoDto | null;

  @ApiProperty({ type: CreditsDto, required: false, nullable: true })
  credits?: CreditsDto | null;

  @ApiProperty({
    type: AvailabilityDto,
    required: false,
    nullable: true,
    description: 'Where to watch - UA primary with US fallback',
  })
  availability?: AvailabilityDto | null;
}
