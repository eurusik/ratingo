import { ApiProperty } from '@nestjs/swagger';

import {
  IMPORT_BATCH_STATUS,
  type ImportBatchStatus,
} from '../../domain/constants/import-pending.constants';

/**
 * Status of an auto-ingest import batch.
 * Returned by GET /api/user-media/import/status.
 */
export class ImportBatchStatusDto {
  @ApiProperty({
    example: 'uuid-here',
    description: 'Unique batch identifier',
  })
  batchId!: string;

  @ApiProperty({
    example: 'kinobaza',
    description: 'Import source identifier',
  })
  source!: string;

  @ApiProperty({
    example: 42,
    description: 'Total number of not-found items submitted for auto-ingestion',
  })
  totalItems!: number;

  @ApiProperty({
    example: 35,
    description: 'Number of items successfully ingested and linked',
  })
  completedCount!: number;

  @ApiProperty({
    example: 3,
    description: 'Number of items that failed to resolve or ingest',
  })
  failedCount!: number;

  @ApiProperty({
    enum: Object.values(IMPORT_BATCH_STATUS),
    example: IMPORT_BATCH_STATUS.PROCESSING,
    description:
      'Batch status: processing while items remain, completed when all done/failed, cancelled when user aborted',
  })
  status!: ImportBatchStatus;

  @ApiProperty({
    example: '2024-01-15T12:00:00.000Z',
    description: 'ISO 8601 timestamp when the batch was created',
  })
  createdAt!: string;
}
