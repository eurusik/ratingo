import { isTelemetryEnabled, toServiceVersion } from '@ratingo/node-telemetry';

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
    enabled: isTelemetryEnabled(env),
    tracesExportRatio: readTracesExportRatio(env),
    serviceName: env.OTEL_SERVICE_NAME || DEFAULT_SERVICE_NAME,
    serviceVersion: toServiceVersion(env.RAILWAY_GIT_COMMIT_SHA),
    environmentName: env.RAILWAY_ENVIRONMENT_NAME ?? env.NODE_ENV ?? 'development',
  };
}
