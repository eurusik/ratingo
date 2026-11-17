import { metrics } from '@opentelemetry/api';
import {
  EVENT_LOOP_UTILIZATION_METRIC,
  PROCESS_CPU_TIME_METRIC,
  PROCESS_MEMORY_METRIC,
} from '@ratingo/node-telemetry';

import { RuntimeMetricsService } from './runtime-metrics.service';
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

  it('reports the shared runtime metrics on the global meter', async () => {
    await expect(collect(PROCESS_MEMORY_METRIC)).resolves.not.toHaveLength(0);
    await expect(collect(PROCESS_CPU_TIME_METRIC)).resolves.not.toHaveLength(0);
    await expect(collect(EVENT_LOOP_UTILIZATION_METRIC)).resolves.toHaveLength(1);
  });

  it('stops observing after module destroy', async () => {
    service.onModuleDestroy();

    await expect(collect(PROCESS_MEMORY_METRIC)).resolves.toHaveLength(0);
  });
});
