import { inspect } from 'node:util';

import { ConsoleLogger, type LogLevel } from '@nestjs/common';

type WriteStream = 'stdout' | 'stderr';

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
    writeStreamType?: WriteStream,
  ): void {
    if (logLevel === 'error') {
      this.pendingError = { messages, context };
      return;
    }
    this.writeEntries(messages, context, logLevel, undefined, writeStreamType);
  }

  protected override printStackTrace(stack?: string): void {
    const pending = this.pendingError;
    this.pendingError = undefined;
    if (!pending) {
      return;
    }
    this.writeEntries(pending.messages, pending.context, 'error', stack, 'stderr');
  }

  private writeEntries(
    messages: unknown[],
    context: string | undefined,
    logLevel: LogLevel,
    stack: string | undefined,
    writeStreamType: WriteStream = 'stdout',
  ): void {
    const stream = writeStreamType === 'stderr' ? process.stderr : process.stdout;
    for (const message of messages) {
      stream.write(`${JSON.stringify(buildEntry(message, context, logLevel, stack))}\n`);
    }
  }
}

function buildEntry(
  message: unknown,
  context: string | undefined,
  logLevel: LogLevel,
  stack: string | undefined,
): Record<string, unknown> {
  const isError = message instanceof Error;
  return {
    time: new Date().toISOString(),
    level: SEVERITY_BY_LEVEL[logLevel],
    context: context || undefined,
    message: isError ? message.message : stringifyMessage(message),
    stack: stack ?? (isError ? message.stack : undefined),
  };
}

const stringifyMessage = (message: unknown): string =>
  typeof message === 'string' ? message : inspect(message, { depth: 5, breakLength: Infinity });
