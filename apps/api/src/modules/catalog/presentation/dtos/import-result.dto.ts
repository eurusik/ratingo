import { ApiProperty } from '@nestjs/swagger';
import { MediaType } from '../../../../common/enums/media-type.enum';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';
import { ImportResult, ImportStatus } from '../../domain/types/import.types';

/**
 * DTO for import operation result.
 */
export class ImportResultDto implements ImportResult {
  @ApiProperty({ enum: ImportStatus })
  status: ImportStatus;

  @ApiProperty({ required: false })
  id?: string;

  @ApiProperty({ required: false })
  slug?: string;

  @ApiProperty({ enum: MediaType })
  type: MediaType;

  @ApiProperty()
  tmdbId: number;

  @ApiProperty({ required: false, enum: IngestionStatus })
  ingestionStatus?: IngestionStatus;

  @ApiProperty({ required: false, description: 'Job ID for polling ingestion status' })
  jobId?: string;
}
