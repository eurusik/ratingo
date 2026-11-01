import { type ApiKeyStatus } from '../constants/api-key-status.const';
import { type MonitoredProvider } from '../constants/monitored-provider.const';

export interface KeyHealthSnapshot {
  provider: MonitoredProvider;
  status: ApiKeyStatus;
  statusCode: number | null;
  latencyMs: number | null;
  detail: string | null;
  quotaRemaining: number | null;
  quotaLimit: number | null;
  checkedAt: Date;
}

export type SaveKeyHealthInput = Omit<KeyHealthSnapshot, 'checkedAt'>;

export interface ProviderFailureCounts {
  unauthorized: number;
  rateLimited: number;
}

export interface ProviderKeyHealth {
  provider: MonitoredProvider;
  latest: KeyHealthSnapshot | null;
  failures: ProviderFailureCounts;
}
