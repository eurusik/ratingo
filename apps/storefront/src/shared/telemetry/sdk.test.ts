import { metrics, trace } from '@opentelemetry/api';

import { startTelemetry } from './sdk';

describe('startTelemetry', () => {
  it('registers no global providers when telemetry is disabled', () => {
    const meterProviderBefore = metrics.getMeterProvider();
    const tracerProviderBefore = trace.getTracerProvider();

    startTelemetry({
      enabled: false,
      tracesExportRatio: 1,
      serviceName: 'ratingo-storefront',
      serviceVersion: 'local',
      environmentName: 'test',
    });

    expect(metrics.getMeterProvider()).toBe(meterProviderBefore);
    expect(trace.getTracerProvider()).toBe(tracerProviderBefore);
  });
});
