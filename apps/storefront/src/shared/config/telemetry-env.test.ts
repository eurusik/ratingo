import { readTelemetryEnv } from './telemetry-env';

const ENABLED = {
  NODE_ENV: 'production',
  OTEL_EXPORTER_OTLP_ENDPOINT: 'http://alloy:4318',
} as const;

describe('readTelemetryEnv', () => {
  it('is disabled without an OTLP endpoint', () => {
    expect(readTelemetryEnv({ NODE_ENV: 'production' }).enabled).toBe(false);
  });

  it('is disabled when the SDK is switched off', () => {
    expect(readTelemetryEnv({ ...ENABLED, OTEL_SDK_DISABLED: 'true' }).enabled).toBe(false);
  });

  it('reads service identity from Railway variables and exports 10% of traces by default', () => {
    expect(
      readTelemetryEnv({
        ...ENABLED,
        RAILWAY_GIT_COMMIT_SHA: 'abcdef1234567',
        RAILWAY_ENVIRONMENT_NAME: 'production',
      }),
    ).toEqual({
      enabled: true,
      tracesExportRatio: 0.1,
      serviceName: 'ratingo-storefront',
      serviceVersion: 'abcdef1',
      environmentName: 'production',
    });
  });

  it('exports no traces when OTEL_TRACES_EXPORTER is none', () => {
    expect(
      readTelemetryEnv({ ...ENABLED, OTEL_TRACES_EXPORTER: 'none', TRACES_EXPORT_RATIO: '1' })
        .tracesExportRatio,
    ).toBe(0);
  });

  it.each([
    ['0.5', 0.5],
    ['1', 1],
    ['7', 1],
    ['-1', 0],
    ['half', 0.1],
  ])('reads TRACES_EXPORT_RATIO=%s as %s', (value, expected) => {
    expect(readTelemetryEnv({ ...ENABLED, TRACES_EXPORT_RATIO: value }).tracesExportRatio).toBe(
      expected,
    );
  });
});
