const SHORT_COMMIT_SHA_LENGTH = 7;
const DEFAULT_SERVICE_NAME = 'ratingo-storefront';
const DEFAULT_TRACES_EXPORT_RATIO = 0.1;
const NO_TRACES = 0;
const ALL_TRACES = 1;

export interface TelemetryEnv {
  enabled: boolean;
  tracesExportRatio: number;
  serviceName: string;
  serviceVersion: string;
  environmentName: string;
}

function readTracesExportRatio(env: NodeJS.ProcessEnv): number {
  if (env.OTEL_TRACES_EXPORTER === 'none') {
    return NO_TRACES;
  }
  const ratio = Number.parseFloat(env.TRACES_EXPORT_RATIO ?? '');
  if (Number.isNaN(ratio)) {
    return DEFAULT_TRACES_EXPORT_RATIO;
  }
  return Math.min(Math.max(ratio, NO_TRACES), ALL_TRACES);
}

export function readTelemetryEnv(env: NodeJS.ProcessEnv = process.env): TelemetryEnv {
  return {
    enabled: Boolean(env.OTEL_EXPORTER_OTLP_ENDPOINT) && env.OTEL_SDK_DISABLED !== 'true',
    tracesExportRatio: readTracesExportRatio(env),
    serviceName: env.OTEL_SERVICE_NAME || DEFAULT_SERVICE_NAME,
    serviceVersion: env.RAILWAY_GIT_COMMIT_SHA?.slice(0, SHORT_COMMIT_SHA_LENGTH) ?? 'local',
    environmentName: env.RAILWAY_ENVIRONMENT_NAME ?? env.NODE_ENV ?? 'development',
  };
}
