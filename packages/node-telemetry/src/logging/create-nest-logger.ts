import { installCrashLogging } from './crash-logging';
import { createStructuredLogger } from './create-structured-logger';
import type { LoggerSettings } from './logger-settings';
import { NestCompatibleLogger, type MessageParser } from './nest-compatible-logger';

export function createNestLogger(
  settings: LoggerSettings,
  parseMessage?: MessageParser,
): NestCompatibleLogger {
  const structured = createStructuredLogger(settings);
  installCrashLogging(structured);
  return new NestCompatibleLogger(structured, parseMessage);
}
