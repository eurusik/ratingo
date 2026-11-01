import { type ApiKeyStatus } from '../constants/api-key-status.const';
import { type MonitoredProvider } from '../constants/monitored-provider.const';

export interface KeyHealthMetricsPort {
  recordProbe(provider: MonitoredProvider, status: ApiKeyStatus, latencyMs: number | null): void;
  recordFailure(provider: MonitoredProvider, code: number): void;
  expose(): Promise<string>;
  readonly contentType: string;
}

export const KEY_HEALTH_METRICS = Symbol('KEY_HEALTH_METRICS');
