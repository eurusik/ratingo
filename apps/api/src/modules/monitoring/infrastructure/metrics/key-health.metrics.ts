import { Injectable } from '@nestjs/common';

import { Counter, Gauge, Registry, collectDefaultMetrics } from 'prom-client';

import { API_KEY_STATUS, type ApiKeyStatus } from '../../domain/constants/api-key-status.const';
import { type MonitoredProvider } from '../../domain/constants/monitored-provider.const';
import { type KeyHealthMetricsPort } from '../../domain/ports/key-health-metrics.port';

const STATUS_VALUE: Record<ApiKeyStatus, number> = {
  [API_KEY_STATUS.VALID]: 1,
  [API_KEY_STATUS.DEGRADED]: 0.5,
  [API_KEY_STATUS.INVALID]: 0,
  [API_KEY_STATUS.UNKNOWN]: -1,
};

@Injectable()
export class KeyHealthMetrics implements KeyHealthMetricsPort {
  readonly registry = new Registry();

  private readonly status = new Gauge({
    name: 'ratingo_api_key_status',
    help: 'External API-key health: 1 valid, 0.5 degraded, 0 invalid, -1 unknown',
    labelNames: ['provider'],
    registers: [this.registry],
  });

  private readonly latency = new Gauge({
    name: 'ratingo_api_key_probe_latency_ms',
    help: 'Latency of the last key-health probe in milliseconds',
    labelNames: ['provider'],
    registers: [this.registry],
  });

  private readonly failures = new Counter({
    name: 'ratingo_external_api_failures_total',
    help: 'Live-traffic external API failures by provider and HTTP status code',
    labelNames: ['provider', 'code'],
    registers: [this.registry],
  });

  constructor() {
    collectDefaultMetrics({ register: this.registry });
  }

  recordProbe(provider: MonitoredProvider, status: ApiKeyStatus, latencyMs: number | null): void {
    this.status.set({ provider }, STATUS_VALUE[status]);
    if (latencyMs !== null) {
      this.latency.set({ provider }, latencyMs);
    }
  }

  recordFailure(provider: MonitoredProvider, code: number): void {
    this.failures.inc({ provider, code: String(code) });
  }

  expose(): Promise<string> {
    return this.registry.metrics();
  }

  get contentType(): string {
    return this.registry.contentType;
  }
}
