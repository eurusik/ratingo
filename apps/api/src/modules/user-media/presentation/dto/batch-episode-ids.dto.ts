import { ApiProperty } from '@nestjs/swagger';

import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class BatchEpisodeIdsDto {
  @ApiProperty({
    description: 'Array of episode UUIDs to mark as watched/unwatched',
    example: ['uuid-1', 'uuid-2', 'uuid-3'],
    type: [String],
    minItems: 1,
    maxItems: 200,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  episodeIds!: string[];
}
