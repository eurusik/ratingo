import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

import {
  CATALOG_DEFAULT_UPCOMING_DAYS,
  CATALOG_MAX_UPCOMING_DAYS,
  DEFAULT_PAGE_SIZE,
} from '@/common/constants';
import { OffsetPaginationMetaDto } from '@/common/dtos';
import {
  MovieReleaseDateKind,
  type MovieReleaseDateKindType,
} from '@/modules/catalog/domain/constants/movie-release.constants';

import { MovieListItemDto } from './movie-list-item.dto';

export const MOVIE_RELEASE_DATE_KIND_VALUES = Object.values(MovieReleaseDateKind);

export class UpcomingMoviesQueryDto {
  @ApiPropertyOptional({ default: DEFAULT_PAGE_SIZE, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset: number = 0;

  @ApiPropertyOptional({
    default: CATALOG_DEFAULT_UPCOMING_DAYS,
    minimum: 0,
    maximum: CATALOG_MAX_UPCOMING_DAYS,
    description: 'Release window from today, in days.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(CATALOG_MAX_UPCOMING_DAYS)
  @Type(() => Number)
  days: number = CATALOG_DEFAULT_UPCOMING_DAYS;
}

export class UpcomingMovieDto extends MovieListItemDto {
  @ApiProperty({
    type: Date,
    description: 'Release date the movie is listed under: theatrical, then digital, then primary.',
  })
  effectiveReleaseDate: Date;

  @ApiProperty({ enum: MOVIE_RELEASE_DATE_KIND_VALUES, example: MovieReleaseDateKind.THEATRICAL })
  releaseDateKind: MovieReleaseDateKindType;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'US',
    description: 'Country of the release date (UA or US); null when unknown.',
  })
  releaseCountry: string | null;
}

export class PaginatedUpcomingMovieResponseDto {
  @ApiProperty({ type: [UpcomingMovieDto] })
  data: UpcomingMovieDto[];

  @ApiProperty({ type: OffsetPaginationMetaDto })
  meta: OffsetPaginationMetaDto;
}
