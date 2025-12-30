import { ApiProperty } from '@nestjs/swagger';

/**
 * Single external rating item.
 */
export class ExternalRatingItemDto {
  @ApiProperty({ example: 8.8 })
  rating: number;

  @ApiProperty({ example: 2000000, required: false, nullable: true })
  voteCount?: number | null;
}

/**
 * External ratings from various sources.
 * Used across modules for displaying third-party ratings.
 */
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
