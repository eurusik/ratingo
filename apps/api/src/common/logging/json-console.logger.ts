import { inspect } from 'node:util';

import { ConsoleLogger, type LogLevel } from '@nestjs/common';

type WriteStream = 'stdout' | 'stderr';

type LogEntry = Record<string, unknown>;

const INSPECT_DEPTH = 5;

const ERROR_MESSAGE_SEPARATOR = ': ';

const SEVERITY_BY_LEVEL: Record<LogLevel, string> = {
  verbose: 'debug',
  debug: 'debug',
  log: 'info',
  warn: 'warn',
  error: 'error',
  fatal: 'error',
};

interface PendingError {
  messages: unknown[];
  context?: string;
}

export class JsonConsoleLogger extends ConsoleLogger {
  private pendingError?: PendingError;

  protected override printMessages(
    messages: unknown[],
    context = '',
    logLevel: LogLevel = 'log',
    writeStreamType: WriteStream = 'stdout',
  ): void {
    if (logLevel === 'error') {
      this.pendingError = { messages, context };
      return;
    }
    for (const message of messages) {
      this.writeLine(writeStreamType, buildEntry(message, context, logLevel));
    }
  }

  protected override printStackTrace(stack?: string): void {
    const pending = this.pendingError;
    this.pendingError = undefined;
    if (!pending) {
      return;
    }
    this.writeLine('stderr', buildErrorEntry(pending, stack));
  }

  private writeLine(writeStreamType: WriteStream, entry: LogEntry): void {
    const stream = writeStreamType === 'stderr' ? process.stderr : process.stdout;
    stream.write(`${JSON.stringify(entry)}\n`);
  }
}

function buildEntry(message: unknown, context: string | undefined, logLevel: LogLevel): LogEntry {
  return {
    time: new Date().toISOString(),
    level: SEVERITY_BY_LEVEL[logLevel],
    context: context || undefined,
    message: describeMessage(message),
    stack: message instanceof Error ? message.stack : undefined,
  };
}

function buildErrorEntry(pending: PendingError, stack: string | undefined): LogEntry {
  const firstError = pending.messages.find((message) => message instanceof Error);
  return {
    time: new Date().toISOString(),
    level: SEVERITY_BY_LEVEL.error,
    context: pending.context || undefined,
    message: pending.messages.map(describeMessage).join(ERROR_MESSAGE_SEPARATOR),
    stack: stack ?? firstError?.stack,
  };
}

function describeMessage(message: unknown): string {
  if (typeof message === 'string') {
    return message;
  }
  if (message instanceof Error) {
    return message.message;
  }
  return inspect(message, { depth: INSPECT_DEPTH, breakLength: Infinity });
}
