import { metrics } from '@opentelemetry/api';

import { EXTERNAL_API_FAILURES_METRIC } from '../../../../telemetry/telemetry.constants';
import { createTestMeterProvider } from '../../../../telemetry/telemetry.testing';
import { MONITORED_PROVIDER } from '../../domain/constants/monitored-provider.const';

import { OtelKeyHealthMetricsAdapter } from './otel-key-health-metrics.adapter';

describe('OtelKeyHealthMetricsAdapter', () => {
  let collect: ReturnType<typeof createTestMeterProvider>['collect'];

  beforeEach(() => {
    const testProvider = createTestMeterProvider();
    collect = testProvider.collect;
    metrics.setGlobalMeterProvider(testProvider.provider);
  });

  afterEach(() => {
    metrics.disable();
  });

  it('counts live failures by provider and status code', async () => {
    const adapter = new OtelKeyHealthMetricsAdapter();

    adapter.recordFailure(MONITORED_PROVIDER.TRAKT, 429);
    adapter.recordFailure(MONITORED_PROVIDER.TRAKT, 429);
    adapter.recordFailure(MONITORED_PROVIDER.TMDB, 401);

    await expect(collect(EXTERNAL_API_FAILURES_METRIC)).resolves.toEqual(
      expect.arrayContaining([
        { value: 2, attributes: { provider: 'trakt', code: '429' } },
        { value: 1, attributes: { provider: 'tmdb', code: '401' } },
      ]),
    );
  });
});
