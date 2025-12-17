import { ApiProperty } from '@nestjs/swagger';

export class NewEpisodeDto {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  showId: string;

  @ApiProperty({ example: 'arcane' })
  slug: string;

  @ApiProperty({ example: 'Arcane' })
  title: string;

  @ApiProperty({ example: '/path/to/poster.jpg', required: false, nullable: true })
  posterPath: string | null;

  @ApiProperty({ example: 2 })
  seasonNumber: number;

  @ApiProperty({ example: 5 })
  episodeNumber: number;

  @ApiProperty({ example: 'Heavy Is the Crown' })
  episodeTitle: string;

  @ApiProperty({ type: Date })
  airDate: Date;
}

export class NewEpisodesResponseDto {
  @ApiProperty({ type: [NewEpisodeDto] })
  data: NewEpisodeDto[];
}
