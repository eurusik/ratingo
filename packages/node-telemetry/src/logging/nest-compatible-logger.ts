import { inspect } from 'node:util';

import { toLogLevel, type LogLevel } from './log-level';
import type { StructuredLogger } from './structured-logger';

const INSPECT_DEPTH = 5;

const MESSAGE_SEPARATOR = ': ';

const FRAMEWORK_STARTUP_CONTEXTS: ReadonlySet<string> = new Set([
  'InstanceLoader',
  'RoutesResolver',
  'RouterExplorer',
]);

const STACK_FORMAT = /^(.)+\n\s+at .+:\d+:\d+/;

export interface ParsedMessage {
  readonly text: string;
  readonly fields?: Readonly<Record<string, unknown>>;
}

export type MessageParser = (text: string) => ParsedMessage;

interface LogCall {
  readonly messages: unknown[];
  readonly context?: string;
  readonly stack?: string;
}

const keepText: MessageParser = (text) => ({ text });

const isStackFormat = (value: unknown): value is string =>
  typeof value === 'string' && STACK_FORMAT.test(value);

const isFieldBag = (value: unknown): value is Record<string, unknown> & { message: string } =>
  typeof value === 'object' &&
  value !== null &&
  !(value instanceof Error) &&
  typeof (value as { message?: unknown }).message === 'string';

function splitContext(args: unknown[]): { messages: unknown[]; context?: string } {
  const last = args[args.length - 1];
  if (args.length <= 1 || typeof last !== 'string') {
    return { messages: args };
  }
  return { messages: args.slice(0, -1), context: last };
}

function parseCall(args: unknown[], withStack: boolean): LogCall {
  if (!withStack) {
    return splitContext(args);
  }
  if (args.length === 2) {
    return isStackFormat(args[1])
      ? { messages: [args[0]], stack: args[1] }
      : { messages: [args[0]], context: args[1] as string | undefined };
  }
  const { messages, context } = splitContext(args);
  const last = messages[messages.length - 1];
  if (messages.length > 1 && (typeof last === 'string' || last === undefined)) {
    return { messages: messages.slice(0, -1), context, stack: last };
  }
  return { messages, context };
}

function mergeFields(
  bags: readonly (Readonly<Record<string, unknown>> | undefined)[],
): Record<string, unknown> {
  return bags.reduce<Record<string, unknown>>((merged, bag) => ({ ...merged, ...bag }), {});
}

function stackOnlyError(message: string, stack: string): Error {
  const error = new Error(message);
  error.stack = stack;
  return error;
}

export class NestCompatibleLogger {
  constructor(
    private readonly logger: StructuredLogger,
    private readonly parseMessage: MessageParser = keepText,
  ) {}

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('log', [message, ...optionalParams]);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('warn', [message, ...optionalParams]);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('debug', [message, ...optionalParams]);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('verbose', [message, ...optionalParams]);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('error', [message, ...optionalParams]);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.emit('fatal', [message, ...optionalParams]);
  }

  flush(): Promise<void> {
    return this.logger.flush();
  }

  private emit(nestLevel: string, args: unknown[]): void {
    const level: LogLevel = toLogLevel(nestLevel) ?? 'info';
    const call = parseCall(args, level === 'error');
    if (level === 'error') {
      this.writeError(call);
      return;
    }
    const effectiveLevel = this.isFrameworkChatter(level, call.context) ? 'debug' : level;
    for (const message of call.messages) {
      this.writeOne(effectiveLevel, message, call.context);
    }
  }

  private isFrameworkChatter(level: LogLevel, context?: string): boolean {
    return level === 'info' && context !== undefined && FRAMEWORK_STARTUP_CONTEXTS.has(context);
  }

  private writeOne(level: LogLevel, message: unknown, context?: string): void {
    const { text, fields } = this.describe(message);
    this.logger.write({
      level,
      message: text,
      context,
      fields,
      error: message instanceof Error ? message : undefined,
    });
  }

  private writeError({ messages, context, stack }: LogCall): void {
    const parts = messages.map((message) => this.describe(message));
    const joined = this.parseMessage(parts.map((part) => part.text).join(MESSAGE_SEPARATOR));
    const error = messages.find((message): message is Error => message instanceof Error);
    this.logger.write({
      level: 'error',
      message: joined.text,
      context,
      fields: mergeFields([...parts.map((part) => part.fields), joined.fields]),
      error: error ?? (stack ? stackOnlyError(joined.text, stack) : undefined),
    });
  }

  private describe(message: unknown): ParsedMessage {
    if (typeof message === 'string') {
      return this.parseMessage(message);
    }
    if (message instanceof Error) {
      return this.parseMessage(message.message);
    }
    if (isFieldBag(message)) {
      const { message: text, ...fields } = message;
      const parsed = this.parseMessage(text);
      return { text: parsed.text, fields: { ...parsed.fields, ...fields } };
    }
    return this.parseMessage(inspect(message, { depth: INSPECT_DEPTH, breakLength: Infinity }));
  }
}
