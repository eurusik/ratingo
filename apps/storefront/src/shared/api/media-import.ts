import type { components } from '@ratingo/api-contract';
import { apiGet, apiPost } from '@ratingo/web-core/api';

type ImportMediaRequest = components['schemas']['ImportMediaDto'];
type CancelImportResponse = components['schemas']['CancelImportBatchesResponseDto'];
export type MediaImportResult = components['schemas']['CsvImportResultDto'];
export type ImportBatch = components['schemas']['ImportBatchStatusDto'];

export const mediaImportApi = {
  importMedia(request: ImportMediaRequest): Promise<MediaImportResult> {
    return apiPost<MediaImportResult>('user-media/import', request);
  },

  getBatches(): Promise<ImportBatch[]> {
    return apiGet<ImportBatch[]>('user-media/import/status');
  },

  cancelBatches(batchIds: readonly string[]): Promise<CancelImportResponse> {
    return apiPost<CancelImportResponse>('user-media/import/cancel', { batchIds });
  },
} as const;
