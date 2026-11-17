const SHORT_COMMIT_SHA_LENGTH = 7;
const DEFAULT_SERVICE_NAME = 'ratingo-storefront';

export interface TelemetryEnv {
  enabled: boolean;
  exportTraces: boolean;
  serviceName: string;
  serviceVersion: string;
  environmentName: string;
}

export function readTelemetryEnv(env: NodeJS.ProcessEnv = process.env): TelemetryEnv {
  return {
    enabled: Boolean(env.OTEL_EXPORTER_OTLP_ENDPOINT) && env.OTEL_SDK_DISABLED !== 'true',
    exportTraces: env.OTEL_TRACES_EXPORTER !== 'none',
    serviceName: env.OTEL_SERVICE_NAME || DEFAULT_SERVICE_NAME,
    serviceVersion: env.RAILWAY_GIT_COMMIT_SHA?.slice(0, SHORT_COMMIT_SHA_LENGTH) ?? 'local',
    environmentName: env.RAILWAY_ENVIRONMENT_NAME ?? env.NODE_ENV ?? 'development',
  };
}
