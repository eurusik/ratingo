import type { components } from '@ratingo/api-contract';

import { apiGet, apiPost } from './client';

export type ImportRequest = components['schemas']['ImportMediaDto'];
export type ImportResult = components['schemas']['CsvImportResultDto'];
export type ImportBatchStatus = components['schemas']['ImportBatchStatusDto'];

export const userMediaApi = {
  async importMedia(data: ImportRequest): Promise<ImportResult> {
    return apiPost<ImportResult>('user-media/import', data);
  },

  async getImportStatus(): Promise<ImportBatchStatus[]> {
    return apiGet<ImportBatchStatus[]>('user-media/import/status');
  },
} as const;
