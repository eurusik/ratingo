import { type MonitoredProvider } from '../constants/monitored-provider.const';

export interface KeyHealthMetricsPort {
  recordFailure(provider: MonitoredProvider, code: number): void;
}

export const KEY_HEALTH_METRICS = Symbol('KEY_HEALTH_METRICS');
