import { ApiProperty } from '@nestjs/swagger';

export class CalendarEpisodeDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  showId: string;

  @ApiProperty({ example: 'Arcane' })
  showTitle: string;

  @ApiProperty({ example: '/path/to/poster.jpg', required: false, nullable: true })
  posterPath: string | null;

  @ApiProperty({ example: 2 })
  seasonNumber: number;

  @ApiProperty({ example: 1 })
  episodeNumber: number;

  @ApiProperty({ example: 'Heavy Is the Crown' })
  title: string;

  @ApiProperty({ example: 'Overview...', required: false, nullable: true })
  overview: string | null;

  @ApiProperty({ type: Date })
  airDate: Date;

  @ApiProperty({ example: 45, required: false, nullable: true })
  runtime: number | null;

  @ApiProperty({ example: 'http://image.com/1.jpg', required: false, nullable: true })
  stillPath: string | null;
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
}
