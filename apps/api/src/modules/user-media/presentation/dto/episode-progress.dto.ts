import { ApiProperty } from '@nestjs/swagger';

/**
 * Season progress information.
 */
export class SeasonProgressDto {
  @ApiProperty({ example: 1, description: 'Season number' })
  seasonNumber!: number;

  @ApiProperty({ example: 5, description: 'Number of watched episodes' })
  watchedCount!: number;

  @ApiProperty({ example: 8, description: 'Total episodes in season' })
  totalCount!: number;

  @ApiProperty({
    example: ['uuid-1', 'uuid-2'],
    description: 'IDs of watched episodes',
    type: [String],
  })
  watchedEpisodeIds!: string[];
}

/**
 * Show progress response.
 */
export class ShowProgressDto {
  @ApiProperty({ example: 'uuid-show-id', description: 'Show ID' })
  showId!: string;

  @ApiProperty({ type: [SeasonProgressDto], description: 'Progress per season' })
  seasons!: SeasonProgressDto[];
}
