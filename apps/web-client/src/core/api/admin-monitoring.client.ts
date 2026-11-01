import type { components } from '@ratingo/api-contract';
import { apiGet, apiPost } from './client';

export type KeyHealthDashboard = components['schemas']['KeyHealthDashboardDto'];
export type ProviderKeyHealth = components['schemas']['ProviderKeyHealthDto'];
export type KeyHealthSnapshot = components['schemas']['KeyHealthSnapshotDto'];
export type KeyHealthHistory = components['schemas']['KeyHealthHistoryDto'];

export const adminMonitoringApi = {
  async getKeys(): Promise<KeyHealthDashboard> {
    return apiGet<KeyHealthDashboard>('admin/monitoring/keys');
  },

  async checkNow(): Promise<KeyHealthDashboard> {
    return apiPost<KeyHealthDashboard>('admin/monitoring/keys/check');
  },

  async getHistory(provider: string, limit?: number): Promise<KeyHealthHistory> {
    return apiGet<KeyHealthHistory>(`admin/monitoring/keys/${provider}/history`, {
      searchParams: limit ? { limit } : undefined,
    });
  },
};
