import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CalendarEpisodeDto {
  @ApiProperty({ example: '0b6f2c1e-5d8a-4f3b-9c2e-7a1d4e6f8b90' })
  episodeId: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Media item ID of the show.',
  })
  showId: string;

  @ApiProperty({
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
    description: 'Show record ID used by episode progress endpoints.',
  })
  showRecordId: string;

  @ApiProperty({ example: 'arcane' })
  showSlug: string;

  @ApiProperty({ example: 'Arcane' })
  showTitle: string;

  @ApiProperty({ type: String, example: '/path/to/poster.jpg', required: false, nullable: true })
  posterPath: string | null;

  @ApiProperty({ example: 2 })
  seasonNumber: number;

  @ApiProperty({ example: 1 })
  episodeNumber: number;

  @ApiProperty({ type: String, example: 'Heavy Is the Crown', nullable: true })
  title: string | null;

  @ApiProperty({ type: String, example: 'Overview...', required: false, nullable: true })
  overview: string | null;

  @ApiProperty({ type: Date })
  airDate: Date;

  @ApiProperty({ type: Number, example: 45, required: false, nullable: true })
  runtime: number | null;

  @ApiProperty({ type: String, example: 'http://image.com/1.jpg', required: false, nullable: true })
  stillPath: string | null;

  @ApiProperty({
    type: Number,
    example: 8,
    nullable: true,
    description: 'Number of episodes in the season, when known.',
  })
  seasonEpisodeCount: number | null;

  @ApiProperty({ example: 312.4, description: 'TMDB popularity of the show.' })
  showPopularity: number;

  @ApiProperty({ example: false, description: 'The viewer is watching this show.' })
  isTracked: boolean;

  @ApiProperty({ example: false, description: 'The viewer saved this show to watch later.' })
  isSaved: boolean;

  @ApiProperty({ example: false, description: 'The viewer marked this episode as watched.' })
  isWatched: boolean;
}

export class CalendarDayDto {
  @ApiProperty({ example: '2024-11-09' })
  date: string;

  @ApiProperty({ type: [CalendarEpisodeDto] })
  episodes: CalendarEpisodeDto[];
}

export class CalendarResponseDto {
  @ApiProperty({ example: '2024-11-01T00:00:00.000Z' })
  startDate: string;

  @ApiProperty({ example: '2024-11-08T00:00:00.000Z' })
  endDate: string;

  @ApiProperty({ type: [CalendarDayDto] })
  days: CalendarDayDto[];

  @ApiPropertyOptional({
    description:
      'Number of shows the user is currently watching (saved shows are not counted). Only present when personalized=true.',
    type: Number,
  })
  watchingShowsCount?: number;
}
