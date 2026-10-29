import { metrics } from '@opentelemetry/api';

import { IMPORT_LINK_SWEEP_METRIC } from '../../../../telemetry/telemetry.constants';
import { createTestMeterProvider } from '../../../../telemetry/telemetry.testing';

import { OtelImportLinkMetricsAdapter } from './otel-import-link-metrics.adapter';

describe('OtelImportLinkMetricsAdapter', () => {
  let collect: ReturnType<typeof createTestMeterProvider>['collect'];

  beforeEach(() => {
    const testProvider = createTestMeterProvider();
    collect = testProvider.collect;
    metrics.setGlobalMeterProvider(testProvider.provider);
  });

  afterEach(() => {
    metrics.disable();
  });

  it('counts linked and timed-out items across sweeps', async () => {
    const adapter = new OtelImportLinkMetricsAdapter();

    adapter.recordSweep({ linked: 15, timedOut: 0 });
    adapter.recordSweep({ linked: 2, timedOut: 3 });

    await expect(collect(IMPORT_LINK_SWEEP_METRIC)).resolves.toEqual(
      expect.arrayContaining([
        { value: 17, attributes: { outcome: 'linked' } },
        { value: 3, attributes: { outcome: 'timed_out' } },
      ]),
    );
  });
});
