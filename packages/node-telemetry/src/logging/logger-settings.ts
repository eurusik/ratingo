import { isTelemetryEnabled } from '../export-config';

import type { LogIdentity } from './log-record';
import { toLogLevel, type LogLevel } from './log-level';

export const LOG_FORMATS = ['json', 'pretty'] as const;

export type LogFormat = (typeof LOG_FORMATS)[number];

const DEPLOYED_MIN_LEVEL: LogLevel = 'info';

const LOCAL_MIN_LEVEL: LogLevel = 'debug';

const DEFAULT_ENVIRONMENT = 'development';

type LoggerEnvironment = Readonly<Record<string, string | undefined>>;

export interface LoggerSettings {
  readonly identity: LogIdentity;
  readonly format: LogFormat;
  readonly minLevel: LogLevel;
  readonly otlpEndpoint?: string;
}

const isDeployed = (env: LoggerEnvironment): boolean =>
  env.NODE_ENV === 'production' || Boolean(env.RAILWAY_ENVIRONMENT_NAME);

const isLogFormat = (value: string): value is LogFormat =>
  (LOG_FORMATS as readonly string[]).includes(value);

function resolveFormat(env: LoggerEnvironment): LogFormat {
  const requested = env.LOG_FORMAT;
  if (!requested) {
    return isDeployed(env) ? 'json' : 'pretty';
  }
  if (!isLogFormat(requested)) {
    throw new Error(
      `Invalid LOG_FORMAT "${requested}". Expected one of: ${LOG_FORMATS.join(', ')}`,
    );
  }
  return requested;
}

function resolveMinLevel(env: LoggerEnvironment): LogLevel {
  const requested = env.LOG_LEVEL;
  if (!requested) {
    return isDeployed(env) ? DEPLOYED_MIN_LEVEL : LOCAL_MIN_LEVEL;
  }
  const level = toLogLevel(requested);
  if (!level) {
    throw new Error(
      `Invalid LOG_LEVEL "${requested}". Expected one of: verbose, debug, log, info, warn, error, fatal`,
    );
  }
  return level;
}

export function resolveLoggerSettings(
  env: LoggerEnvironment,
  defaultService: string,
): LoggerSettings {
  return {
    identity: {
      service: env.OTEL_SERVICE_NAME || defaultService,
      environment: env.RAILWAY_ENVIRONMENT_NAME ?? env.NODE_ENV ?? DEFAULT_ENVIRONMENT,
    },
    format: resolveFormat(env),
    minLevel: resolveMinLevel(env),
    otlpEndpoint: isTelemetryEnabled(env) ? env.OTEL_EXPORTER_OTLP_ENDPOINT : undefined,
  };
}
