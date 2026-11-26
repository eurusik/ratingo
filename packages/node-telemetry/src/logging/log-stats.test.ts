import { type Attributes, metrics } from '@opentelemetry/api';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';

import { LOG_BYTES_METRIC, LOG_RECORDS_METRIC } from '../metric-names';

import { createLogMetrics } from './log-stats';

class CollectingReader extends MetricReader {
  protected onShutdown(): Promise<void> {
    return Promise.resolve();
  }

  protected onForceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

describe('createLogMetrics', () => {
  it('counts records by outcome and level and bytes by outcome', async () => {
    const reader = new CollectingReader();
    metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));

    const stats = createLogMetrics();
    stats.record('shipped', 'info', 300);
    stats.record('shipped', 'info', 200);
    stats.record('dropped_daily_cap', 'warn', 100);

    const { resourceMetrics } = await reader.collect();
    const byName = new Map(
      resourceMetrics.scopeMetrics
        .flatMap((scope) => scope.metrics)
        .map((metric) => [
          metric.descriptor.name,
          metric.dataPoints.map((point) => ({
            attributes: point.attributes,
            value: point.value as number,
          })),
        ]),
    );
    const value = (name: string, attributes: Attributes) =>
      byName
        .get(name)
        ?.find((point) => JSON.stringify(point.attributes) === JSON.stringify(attributes))?.value;
    expect(value(LOG_RECORDS_METRIC, { outcome: 'shipped', level: 'info' })).toBe(2);
    expect(value(LOG_RECORDS_METRIC, { outcome: 'dropped_daily_cap', level: 'warn' })).toBe(1);
    expect(value(LOG_BYTES_METRIC, { outcome: 'shipped' })).toBe(500);
    expect(value(LOG_BYTES_METRIC, { outcome: 'dropped_daily_cap' })).toBe(100);
  });
});

describe('createLogMetrics before telemetry starts', () => {
  it('counts records once a meter provider is registered after the logger was created', async () => {
    metrics.disable();
    const stats = createLogMetrics();
    stats.record('shipped', 'info', 10);

    const reader = new CollectingReader();
    metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));
    stats.record('shipped', 'info', 20);

    const { resourceMetrics } = await reader.collect();
    const bytes = resourceMetrics.scopeMetrics
      .flatMap((scope) => scope.metrics)
      .find((metric) => metric.descriptor.name === LOG_BYTES_METRIC);
    expect(bytes?.dataPoints.map((point) => point.value)).toEqual([20]);
  });
});
