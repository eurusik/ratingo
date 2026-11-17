import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';

import {
  EVENT_LOOP_DELAY_METRIC,
  EVENT_LOOP_UTILIZATION_METRIC,
  PROCESS_CPU_TIME_METRIC,
  PROCESS_MEMORY_METRIC,
} from './metric-names';
import { registerRuntimeMetrics } from './runtime-metrics';

class TestMetricReader extends MetricReader {
  protected onForceFlush(): Promise<void> {
    return Promise.resolve();
  }

  protected onShutdown(): Promise<void> {
    return Promise.resolve();
  }
}

interface CollectedPoint {
  value: unknown;
  attributes: Record<string, unknown>;
}

interface CollectedMetric {
  unit: string;
  points: CollectedPoint[];
}

const waitForEventLoopSamples = () => new Promise((resolve) => setTimeout(resolve, 100));

describe('registerRuntimeMetrics', () => {
  let reader: TestMetricReader;
  let unregister: () => void;

  const collect = async (metricName: string): Promise<CollectedMetric> => {
    const { resourceMetrics } = await reader.collect();
    const metric = resourceMetrics.scopeMetrics
      .flatMap((scope) => scope.metrics)
      .find((candidate) => candidate.descriptor.name === metricName);
    return {
      unit: metric?.descriptor.unit ?? '',
      points: (metric?.dataPoints ?? []).map((point) => ({
        value: point.value,
        attributes: point.attributes,
      })),
    };
  };

  beforeEach(() => {
    reader = new TestMetricReader();
    const provider = new MeterProvider({ readers: [reader] });
    unregister = registerRuntimeMetrics(provider.getMeter('test'));
  });

  afterEach(() => {
    unregister();
  });

  it('reports process memory in bytes by type', async () => {
    const { unit, points } = await collect(PROCESS_MEMORY_METRIC);

    expect(unit).toBe('By');
    expect(points.map(({ attributes }) => attributes)).toEqual([
      { type: 'rss' },
      { type: 'heap_used' },
      { type: 'heap_total' },
      { type: 'external' },
      { type: 'array_buffers' },
    ]);
    points
      .filter(({ attributes }) => attributes.type !== 'array_buffers')
      .forEach(({ value }) => expect(value).toBeGreaterThan(0));
  });

  it('reports event loop delay percentiles in seconds once samples exist', async () => {
    await waitForEventLoopSamples();

    const { unit, points } = await collect(EVENT_LOOP_DELAY_METRIC);

    expect(unit).toBe('s');
    expect(points.map(({ attributes }) => attributes.percentile).sort()).toEqual([
      'max',
      'p50',
      'p99',
    ]);
    points.forEach(({ value }) => expect(value).toBeLessThan(1));
  });

  it('reports the share of time the event loop was busy', async () => {
    const { unit, points } = await collect(EVENT_LOOP_UTILIZATION_METRIC);

    expect(unit).toBe('1');
    expect(points).toHaveLength(1);
    expect(points[0].value).toBeGreaterThanOrEqual(0);
    expect(points[0].value).toBeLessThanOrEqual(1);
  });

  it('reports CPU time in seconds by mode that never decreases between exports', async () => {
    const userCpu = async () => {
      const { points } = await collect(PROCESS_CPU_TIME_METRIC);
      return points.find(({ attributes }) => attributes['cpu.mode'] === 'user')?.value as number;
    };

    const { unit, points } = await collect(PROCESS_CPU_TIME_METRIC);
    const first = await userCpu();
    const second = await userCpu();

    expect(unit).toBe('s');
    expect(points.map(({ attributes }) => attributes)).toEqual([
      { 'cpu.mode': 'user' },
      { 'cpu.mode': 'system' },
    ]);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(process.uptime() * 64);
    expect(second).toBeGreaterThanOrEqual(first);
  });

  it('stops observing once unregistered', async () => {
    unregister();

    await expect(collect(PROCESS_MEMORY_METRIC)).resolves.toMatchObject({ points: [] });
  });
});
