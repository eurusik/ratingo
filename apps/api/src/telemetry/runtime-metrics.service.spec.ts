import { metrics } from '@opentelemetry/api';

import { RuntimeMetricsService } from './runtime-metrics.service';
import { EVENT_LOOP_DELAY_METRIC, PROCESS_MEMORY_METRIC } from './telemetry.constants';
import { createTestMeterProvider } from './telemetry.testing';

describe('RuntimeMetricsService', () => {
  let collect: ReturnType<typeof createTestMeterProvider>['collect'];
  let service: RuntimeMetricsService;

  beforeEach(() => {
    const testProvider = createTestMeterProvider();
    collect = testProvider.collect;
    metrics.setGlobalMeterProvider(testProvider.provider);
    service = new RuntimeMetricsService();
    service.onModuleInit();
  });

  afterEach(() => {
    service.onModuleDestroy();
    metrics.disable();
  });

  it('reports process memory by type', async () => {
    const points = await collect(PROCESS_MEMORY_METRIC);

    expect(points.map((point) => point.attributes.type).sort()).toEqual([
      'heap_total',
      'heap_used',
      'rss',
    ]);
    points.forEach((point) => expect(point.value).toBeGreaterThan(0));
  });

  it('reports event loop delay percentiles in seconds once samples exist', async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));

    const points = await collect(EVENT_LOOP_DELAY_METRIC);

    expect(points.map((point) => point.attributes.percentile).sort()).toEqual([
      'max',
      'p50',
      'p99',
    ]);
    points.forEach((point) => expect(point.value).toBeLessThan(1));
  });

  it('stops observing after module destroy', async () => {
    service.onModuleDestroy();

    await expect(collect(PROCESS_MEMORY_METRIC)).resolves.toHaveLength(0);
  });
});
