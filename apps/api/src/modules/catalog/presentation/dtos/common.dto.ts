import { ApiProperty } from '@nestjs/swagger';

export class GenreDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @ApiProperty({ example: 'Action' })
  name: string;

  @ApiProperty({ example: 'action' })
  slug: string;
}

export class RatingoStatsDto {
  @ApiProperty({ example: 85.5, description: 'Composite Hype Score (0-100)', required: false, nullable: true })
  ratingoScore?: number | null;

  @ApiProperty({ example: 88.5, description: 'Quality Score (0-100)', required: false, nullable: true })
  qualityScore?: number | null;

  @ApiProperty({ example: 45.2, description: 'Popularity Score (0-100)', required: false, nullable: true })
  popularityScore?: number | null;
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

  @ApiProperty({ example: '/path/to/poster.jpg', required: false, nullable: true })
  posterPath?: string | null;

  @ApiProperty({ example: '/path/to/backdrop.jpg', required: false, nullable: true })
  backdropPath?: string | null;

  @ApiProperty({ type: RatingoStatsDto, required: false, nullable: true })
  stats?: RatingoStatsDto | null;

  @ApiProperty({ type: ExternalRatingsDto, required: false, nullable: true })
  externalRatings?: ExternalRatingsDto | null;

  @ApiProperty({ type: [GenreDto], required: false })
  genres?: GenreDto[];
}
