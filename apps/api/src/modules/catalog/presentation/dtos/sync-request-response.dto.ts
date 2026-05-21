import { ApiProperty } from '@nestjs/swagger';

export class SyncRequestResponseDto {
  @ApiProperty({ description: 'Whether a sync job was queued' })
  queued: boolean;

  @ApiProperty({
    type: Date,
    nullable: true,
    description: 'When the show metadata was last successfully synced',
  })
  lastSyncedAt: Date | null;

  @ApiProperty({
    type: Date,
    nullable: true,
    description: 'When the next sync can be requested (null if not on cooldown)',
  })
  cooldownExpiresAt: Date | null;
}
