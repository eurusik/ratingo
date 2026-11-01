import { type ApiKeyStatus } from '../constants/api-key-status.const';
import { type MonitoredProvider } from '../constants/monitored-provider.const';

export interface KeyProbeResult {
  status: ApiKeyStatus;
  statusCode?: number | null;
  latencyMs?: number | null;
  detail?: string | null;
  quotaRemaining?: number | null;
  quotaLimit?: number | null;
}

export interface KeyProbe {
  readonly provider: MonitoredProvider;
  probe(): Promise<KeyProbeResult>;
}

export const KEY_PROBES = Symbol('KEY_PROBES');
