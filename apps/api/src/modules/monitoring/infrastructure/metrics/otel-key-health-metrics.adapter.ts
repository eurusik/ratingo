import { Injectable } from '@nestjs/common';

import { type Counter, metrics } from '@opentelemetry/api';

import { type MonitoredProvider } from '@/modules/monitoring/domain/constants/monitored-provider.const';
import { type KeyHealthMetricsPort } from '@/modules/monitoring/domain/ports/key-health-metrics.port';
import { EXTERNAL_API_FAILURES_METRIC, METER_NAME } from '@/telemetry/telemetry.constants';

@Injectable()
export class OtelKeyHealthMetricsAdapter implements KeyHealthMetricsPort {
  private readonly failures: Counter = metrics
    .getMeter(METER_NAME)
    .createCounter(EXTERNAL_API_FAILURES_METRIC, {
      description: 'Live-traffic external API failures by provider and HTTP status code',
    });

  recordFailure(provider: MonitoredProvider, code: number): void {
    this.failures.add(1, { provider, code: String(code) });
  }
}
