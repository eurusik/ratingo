import { ConsoleLogger, type LoggerService, type LogLevel } from '@nestjs/common';

import { JsonConsoleLogger } from './json-console.logger';

export const LOG_LEVELS: readonly LogLevel[] = [
  'verbose',
  'debug',
  'log',
  'warn',
  'error',
  'fatal',
];

export const LOG_FORMATS = ['json', 'pretty'] as const;

export type LogFormat = (typeof LOG_FORMATS)[number];

const DEPLOYED_MIN_LEVEL: LogLevel = 'log';

const LOCAL_MIN_LEVEL: LogLevel = 'verbose';

const isDeployed = (env: NodeJS.ProcessEnv): boolean =>
  env.NODE_ENV === 'production' || Boolean(env.RAILWAY_ENVIRONMENT_NAME);

const isLogFormat = (value: string): value is LogFormat =>
  (LOG_FORMATS as readonly string[]).includes(value);

const isLogLevel = (value: string): value is LogLevel =>
  (LOG_LEVELS as readonly string[]).includes(value);

export function getLogFormat(env: NodeJS.ProcessEnv = process.env): LogFormat {
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

export function getLogLevels(env: NodeJS.ProcessEnv = process.env): LogLevel[] {
  const requested = env.LOG_LEVEL || (isDeployed(env) ? DEPLOYED_MIN_LEVEL : LOCAL_MIN_LEVEL);
  if (!isLogLevel(requested)) {
    throw new Error(`Invalid LOG_LEVEL "${requested}". Expected one of: ${LOG_LEVELS.join(', ')}`);
  }
  return LOG_LEVELS.slice(LOG_LEVELS.indexOf(requested));
}

export function createAppLogger(env: NodeJS.ProcessEnv = process.env): LoggerService {
  const logger = getLogFormat(env) === 'json' ? new JsonConsoleLogger() : new ConsoleLogger();
  logger.setLogLevels(getLogLevels(env));
  return logger;
}
