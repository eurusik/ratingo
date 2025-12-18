import { MediaType } from '../../../../common/enums/media-type.enum';
import { IngestionStatus } from '../../../../common/enums/ingestion-status.enum';

/**
 * Status of an import operation.
 */
export enum ImportStatus {
  EXISTS = 'exists',
  IMPORTING = 'importing',
  READY = 'ready',
  FAILED = 'failed',
  NOT_FOUND = 'not_found',
}

/**
 * Result of an import operation.
 */
export interface ImportResult {
  status: ImportStatus;
  id?: string;
  slug?: string;
  type: MediaType;
  tmdbId: number;
  ingestionStatus?: IngestionStatus;
  jobId?: string;
}
