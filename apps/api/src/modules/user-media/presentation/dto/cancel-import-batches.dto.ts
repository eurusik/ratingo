import { ApiProperty } from '@nestjs/swagger';

import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

/**
 * Request body for POST /user-media/import/cancel.
 * Accepts multiple batch IDs to support cancelling all active batches in one call.
 */
export class CancelImportBatchesDto {
  @ApiProperty({
    type: [String],
    description: 'UUIDs of the import batches to cancel',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  batchIds!: string[];
}

export class CancelImportBatchesResponseDto {
  @ApiProperty({
    type: [String],
    description: 'Batch IDs that failed to cancel (not found or already terminal)',
    example: [],
  })
  failedBatchIds!: string[];
}
