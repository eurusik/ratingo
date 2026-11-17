import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, Max, Min } from 'class-validator';

import { CATALOG_DEFAULT_CALENDAR_DAYS, CATALOG_MAX_CALENDAR_DAYS } from '@/common/constants';
import { ImageDto } from '@/common/dtos/image.dto';
import {
  CalendarMediaType,
  type CalendarMediaTypeValue,
} from '@/modules/catalog/domain/constants/catalog.constants';
import { type MovieReleaseDateKindType } from '@/modules/catalog/domain/constants/movie-release.constants';

import { CalendarEpisodeDto } from './calendar-response.dto';
import { MOVIE_RELEASE_DATE_KIND_VALUES } from './upcoming-movies.dto';

const CALENDAR_MEDIA_TYPE_VALUES = Object.values(CalendarMediaType);
const BOOLEAN_FLAG_VALUES = ['true', 'false'];

export class CatalogCalendarQueryDto {
  @ApiPropertyOptional({ description: 'Start date (ISO string). Default: today.' })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({
    default: CATALOG_DEFAULT_CALENDAR_DAYS,
    minimum: 0,
    maximum: CATALOG_MAX_CALENDAR_DAYS,
    description: 'Number of days to include.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(CATALOG_MAX_CALENDAR_DAYS)
  @Type(() => Number)
  days: number = CATALOG_DEFAULT_CALENDAR_DAYS;

  @ApiPropertyOptional({
    enum: BOOLEAN_FLAG_VALUES,
    description:
      "When true, returns only the viewer's releases: episodes of shows they watch, premieres of shows they saved, and movies they saved or set a release reminder for. Requires authentication.",
  })
  @IsOptional()
  @IsIn(BOOLEAN_FLAG_VALUES)
  personalized?: string;

  @ApiPropertyOptional({
    enum: CALENDAR_MEDIA_TYPE_VALUES,
    description: 'Limits the calendar to shows or movies.',
  })
  @IsOptional()
  @IsIn(CALENDAR_MEDIA_TYPE_VALUES)
  type?: CalendarMediaTypeValue;
}

export class CalendarMovieDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  mediaItemId: string;

  @ApiProperty({ example: 693134 })
  tmdbId: number;

  @ApiProperty({ example: 'dune-part-two' })
  slug: string;

  @ApiProperty({ example: 'Dune: Part Two' })
  title: string;

  @ApiProperty({ type: ImageDto, nullable: true })
  poster: ImageDto | null;

  @ApiProperty({
    type: Date,
    description: 'Release date the movie is listed under: theatrical, then digital, then primary.',
  })
  releaseDate: Date;

  @ApiProperty({ enum: MOVIE_RELEASE_DATE_KIND_VALUES })
  releaseDateKind: MovieReleaseDateKindType;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'US',
    description: 'Country of the release date (UA or US); null when unknown.',
  })
  releaseCountry: string | null;

  @ApiProperty({ example: 312.4, description: 'TMDB popularity.' })
  popularity: number;

  @ApiProperty({
    example: false,
    description: 'The viewer planned this movie or saved it to watch later.',
  })
  isSavedForLater: boolean;

  @ApiProperty({ example: false, description: 'The viewer set a release reminder.' })
  isReminderSet: boolean;
}

export class CatalogCalendarDayDto {
  @ApiProperty({ example: '2026-11-20' })
  date: string;

  @ApiProperty({ type: [CalendarEpisodeDto] })
  episodes: CalendarEpisodeDto[];

  @ApiProperty({ type: [CalendarMovieDto] })
  movies: CalendarMovieDto[];

  @ApiPropertyOptional({
    type: Number,
    description:
      'Movies released that day beyond the ones listed (only in the non-personalized calendar).',
  })
  moreMoviesCount?: number;
}

export class CatalogCalendarResponseDto {
  @ApiProperty({ example: '2026-11-17T00:00:00.000Z' })
  startDate: string;

  @ApiProperty({ example: '2026-11-24T00:00:00.000Z' })
  endDate: string;

  @ApiPropertyOptional({
    type: Number,
    description:
      'Number of shows the user is currently watching (saved shows are not counted). Only present when personalized=true and shows are included.',
  })
  watchingShowsCount?: number;

  @ApiProperty({ type: [CatalogCalendarDayDto] })
  days: CatalogCalendarDayDto[];
}
