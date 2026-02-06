import { ApiProperty } from '@nestjs/swagger';

import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

import { MAX_BATCH_EPISODE_IDS } from '../../domain/constants/episode-progress.constants';

export class BatchEpisodeIdsDto {
  @ApiProperty({
    description: 'Array of episode UUIDs to mark as watched/unwatched',
    example: [
      'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
      'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
    ],
    type: [String],
    minItems: 1,
    maxItems: MAX_BATCH_EPISODE_IDS,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_BATCH_EPISODE_IDS)
  @IsUUID('4', { each: true })
  episodeIds!: string[];
}
