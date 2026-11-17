import { readTelemetryEnv } from './telemetry-env';

describe('readTelemetryEnv', () => {
  it('is disabled without an OTLP endpoint', () => {
    expect(readTelemetryEnv({ NODE_ENV: 'production' }).enabled).toBe(false);
  });

  it('is disabled when the SDK is switched off', () => {
    expect(
      readTelemetryEnv({
        NODE_ENV: 'production',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://alloy:4318',
        OTEL_SDK_DISABLED: 'true',
      }).enabled,
    ).toBe(false);
  });

  it('reads service identity from Railway variables', () => {
    expect(
      readTelemetryEnv({
        NODE_ENV: 'production',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://alloy:4318',
        RAILWAY_GIT_COMMIT_SHA: 'abcdef1234567',
        RAILWAY_ENVIRONMENT_NAME: 'production',
      }),
    ).toEqual({
      enabled: true,
      exportTraces: true,
      serviceName: 'ratingo-storefront',
      serviceVersion: 'abcdef1',
      environmentName: 'production',
    });
  });

  it('skips trace export when OTEL_TRACES_EXPORTER is none', () => {
    expect(
      readTelemetryEnv({
        NODE_ENV: 'production',
        OTEL_EXPORTER_OTLP_ENDPOINT: 'http://alloy:4318',
        OTEL_TRACES_EXPORTER: 'none',
      }).exportTraces,
    ).toBe(false);
  });
});
