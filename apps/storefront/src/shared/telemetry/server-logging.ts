import { format } from 'node:util';

import {
  createStructuredLogger,
  type LoggerSettings,
  type LogLevel,
  type StructuredLogger,
} from '@ratingo/node-telemetry';

import { readLoggingEnv } from '@/shared/config/index.server';

const CONSOLE_LEVELS: Readonly<Record<'log' | 'info' | 'debug' | 'warn' | 'error', LogLevel>> = {
  log: 'info',
  info: 'info',
  debug: 'debug',
  warn: 'warn',
  error: 'error',
};

type CapturableConsole = Record<keyof typeof CONSOLE_LEVELS, (...args: unknown[]) => void>;

export function captureConsole(
  logger: StructuredLogger,
  target: CapturableConsole = console as unknown as CapturableConsole,
): void {
  for (const [method, level] of Object.entries(CONSOLE_LEVELS)) {
    target[method as keyof typeof CONSOLE_LEVELS] = (...args: unknown[]) => {
      const error = args.find((arg): arg is Error => arg instanceof Error);
      const printable = args.map((arg) => (arg instanceof Error ? arg.message : arg));
      logger.write({ level, message: format(...printable), error, context: 'console' });
    };
  }
}

export function startServerLogging(
  settings: LoggerSettings = readLoggingEnv(),
): StructuredLogger | undefined {
  if (settings.format !== 'json') {
    return undefined;
  }
  const logger = createStructuredLogger(settings);
  captureConsole(logger);
  return logger;
}
