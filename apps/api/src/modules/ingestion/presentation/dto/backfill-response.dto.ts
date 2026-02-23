import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for ingestion backfill job queueing operations.
 */
export class IngestionJobResponseDto {
  @ApiProperty({ example: 'queued' })
  status: string;

  @ApiProperty({ example: 'backfill_alt_titles_20260223' })
  jobId: string;

  @ApiProperty({ example: 'BACKFILL_ALT_TITLES_DISPATCHER' })
  jobType: string;

  @ApiProperty({ example: false })
  force: boolean;
}
