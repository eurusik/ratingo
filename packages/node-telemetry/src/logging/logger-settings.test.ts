import { resolveLoggerSettings } from './logger-settings';

describe('resolveLoggerSettings', () => {
  it('uses json at info level on Railway', () => {
    const settings = resolveLoggerSettings({ RAILWAY_ENVIRONMENT_NAME: 'production' }, 'api');

    expect(settings).toMatchObject({
      format: 'json',
      minLevel: 'info',
      identity: { service: 'api', environment: 'production' },
    });
  });

  it('uses pretty at debug level locally', () => {
    expect(resolveLoggerSettings({}, 'api')).toMatchObject({
      format: 'pretty',
      minLevel: 'debug',
      identity: { environment: 'development' },
    });
  });

  it('accepts Nest level names and the info alias', () => {
    expect(resolveLoggerSettings({ LOG_LEVEL: 'log' }, 'api').minLevel).toBe('info');
    expect(resolveLoggerSettings({ LOG_LEVEL: 'verbose' }, 'api').minLevel).toBe('debug');
    expect(resolveLoggerSettings({ LOG_LEVEL: 'fatal' }, 'api').minLevel).toBe('error');
  });

  it('rejects unknown formats and levels', () => {
    expect(() => resolveLoggerSettings({ LOG_FORMAT: 'xml' }, 'api')).toThrow(/LOG_FORMAT/);
    expect(() => resolveLoggerSettings({ LOG_LEVEL: 'loud' }, 'api')).toThrow(/LOG_LEVEL/);
  });

  it('lets OTEL_SERVICE_NAME win over the default service', () => {
    expect(
      resolveLoggerSettings({ OTEL_SERVICE_NAME: 'ratingo-worker' }, 'api').identity.service,
    ).toBe('ratingo-worker');
  });

  it('ships only when the OTLP endpoint is set and the SDK is not disabled', () => {
    const endpoint = 'http://alloy.railway.internal:4318';

    expect(
      resolveLoggerSettings({ OTEL_EXPORTER_OTLP_ENDPOINT: endpoint }, 'api').otlpEndpoint,
    ).toBe(endpoint);
    expect(resolveLoggerSettings({}, 'api').otlpEndpoint).toBeUndefined();
    expect(
      resolveLoggerSettings(
        { OTEL_EXPORTER_OTLP_ENDPOINT: endpoint, OTEL_SDK_DISABLED: 'true' },
        'api',
      ).otlpEndpoint,
    ).toBeUndefined();
  });
});
