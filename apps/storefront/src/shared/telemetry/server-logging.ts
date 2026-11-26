import { format } from 'node:util';

import {
  createStructuredLogger,
  type LoggerSettings,
  type LogLevel,
  type StructuredLogger,
} from '@ratingo/node-telemetry';

import { readLoggingEnv } from '@/shared/config/index.server';

type ConsoleMethod = 'log' | 'info' | 'debug' | 'warn' | 'error';

const CONSOLE_LEVELS: Readonly<Record<ConsoleMethod, LogLevel>> = {
  log: 'info',
  info: 'info',
  debug: 'debug',
  warn: 'warn',
  error: 'error',
};

type CapturableConsole = Record<ConsoleMethod, (...args: unknown[]) => void>;

const CONSOLE_METHODS = Object.keys(CONSOLE_LEVELS) as ConsoleMethod[];

let activeLogger: StructuredLogger | undefined;

export function captureConsole(
  logger: StructuredLogger,
  target: CapturableConsole = console as unknown as CapturableConsole,
): void {
  for (const method of CONSOLE_METHODS) {
    target[method] = (...args: unknown[]) => {
      const error = args.find((arg): arg is Error => arg instanceof Error);
      const printable = args.map((arg) => (arg instanceof Error ? arg.message : arg));
      logger.write({
        level: CONSOLE_LEVELS[method],
        message: format(...printable),
        error,
        context: 'console',
      });
    };
  }
}

export function startServerLogging(
  settings: LoggerSettings = readLoggingEnv(),
): StructuredLogger | undefined {
  if (settings.format !== 'json') {
    return undefined;
  }
  if (activeLogger) {
    return activeLogger;
  }
  activeLogger = createStructuredLogger(settings);
  captureConsole(activeLogger);
  return activeLogger;
}
