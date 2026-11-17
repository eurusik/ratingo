import { isTelemetryEnabled } from './export-config';

const ENDPOINT = 'http://alloy:4318';

describe('isTelemetryEnabled', () => {
  it('is disabled without an OTLP endpoint', () => {
    expect(isTelemetryEnabled({})).toBe(false);
  });

  it('is enabled when an OTLP endpoint is configured', () => {
    expect(isTelemetryEnabled({ OTEL_EXPORTER_OTLP_ENDPOINT: ENDPOINT })).toBe(true);
  });

  it('respects OTEL_SDK_DISABLED', () => {
    expect(
      isTelemetryEnabled({ OTEL_EXPORTER_OTLP_ENDPOINT: ENDPOINT, OTEL_SDK_DISABLED: 'true' }),
    ).toBe(false);
  });
});
