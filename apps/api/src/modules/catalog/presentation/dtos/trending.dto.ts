import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, Max, IsUUID } from 'class-validator';
import { ImageDto, ExternalRatingsDto, RatingoStatsDto } from './common.dto';

export class TrendingShowsQueryDto {
  @ApiProperty({ required: false, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;

  @ApiProperty({ required: false, description: 'Filter by minimum Ratingo Score (0-100)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  minRating?: number;

  @ApiProperty({ required: false, description: 'Filter by genre ID (UUID)' })
  @IsOptional()
  @IsUUID()
  genreId?: string;
}

export class ShowProgressDto {
  @ApiProperty({ required: false, nullable: true, description: 'Null for trending list optimization' })
  season?: number | null;

  @ApiProperty({ required: false, nullable: true, description: 'Null for trending list optimization' })
  episode?: number | null;

  @ApiProperty({ required: false, nullable: true, example: 'S5E2', description: 'Null for trending list optimization' })
  label?: string | null;

  @ApiProperty({ required: false, nullable: true })
  lastAirDate: Date | null;

  @ApiProperty({ required: false, nullable: true })
  nextAirDate: Date | null;
}

export class ShowTrendingItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'show' })
  type: 'show';

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
}

export class TrendingShowsResponseDto {
  @ApiProperty({ type: [ShowTrendingItemDto] })
  data: ShowTrendingItemDto[];

  @ApiProperty({
    properties: {
      count: { type: 'number' },
      limit: { type: 'number' },
      offset: { type: 'number' },
    }
  })
  meta: {
    count: number;
    limit: number;
    offset: number;
  };
}

export class MovieTrendingItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'movie' })
  type: 'movie';

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

  @ApiProperty({
    properties: {
      count: { type: 'number' },
      limit: { type: 'number' },
      offset: { type: 'number' },
    }
  })
  meta: {
    count: number;
    limit: number;
    offset: number;
  };
}
