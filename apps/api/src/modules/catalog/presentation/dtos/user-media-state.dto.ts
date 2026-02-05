import { ApiProperty } from '@nestjs/swagger';

export class UserMediaStateDto {
  @ApiProperty({ enum: ['watching', 'completed', 'planned', 'dropped'], example: 'watching' })
  state: 'watching' | 'completed' | 'planned' | 'dropped';

  @ApiProperty({ example: 85, required: false, nullable: true })
  rating?: number | null;

  @ApiProperty({ required: false, nullable: true })
  progress?: Record<string, unknown> | null;

  @ApiProperty({ example: 'Rewatching with friends', required: false, nullable: true })
  notes?: string | null;
}
