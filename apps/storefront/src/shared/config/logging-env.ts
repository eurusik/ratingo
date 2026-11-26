import { type LoggerSettings, resolveLoggerSettings } from '@ratingo/node-telemetry';

const DEFAULT_SERVICE_NAME = 'ratingo-storefront';

export const readLoggingEnv = (env: NodeJS.ProcessEnv = process.env): LoggerSettings =>
  resolveLoggerSettings(env, DEFAULT_SERVICE_NAME);
