import { clearTimeout, setTimeout } from 'node:timers';

import { formatterFor, type LogFormatter } from './log-format';
import { buildLogRecord, type LogIdentity, type LogInput, type LogRecord } from './log-record';
import { isLevelEnabled, type LogLevel } from './log-level';
import type { LogShipper } from './log-shipper';

export interface LogSink {
  write(line: string): void;
}

export interface StructuredLoggerOptions {
  readonly identity: LogIdentity;
  readonly minLevel: LogLevel;
  readonly sink: LogSink;
  readonly formatter?: LogFormatter;
  readonly shipper?: LogShipper;
  readonly now?: () => Date;
  readonly flushTimeoutMs?: number;
  readonly maxRecordBytes?: number;
}

const DEFAULT_FLUSH_TIMEOUT_MS = 3_000;

export type LogDetails = Omit<LogInput, 'level' | 'message'>;

export class StructuredLogger {
  private readonly now: () => Date;
  private readonly formatter: LogFormatter;

  constructor(private readonly options: StructuredLoggerOptions) {
    this.now = options.now ?? (() => new Date());
    this.formatter = options.formatter ?? formatterFor('json');
  }

  write(input: LogInput): void {
    if (!isLevelEnabled(this.options.minLevel, input.level)) {
      return;
    }
    const record = this.build(input);
    if (record === undefined) {
      return;
    }
    this.attempt(() => this.options.sink.write(this.formatter(record)));
    this.attempt(() => this.options.shipper?.enqueue(record));
  }

  private build(input: LogInput): LogRecord | undefined {
    try {
      return buildLogRecord(this.options.identity, input, this.now(), this.options.maxRecordBytes);
    } catch (error) {
      this.writeFallback(input, error);
      return undefined;
    }
  }

  private attempt(action: () => void): void {
    try {
      action();
    } catch {
      return;
    }
  }

  private writeFallback(input: LogInput, failure: unknown): void {
    try {
      const reason = failure instanceof Error ? failure.message : String(failure);
      const record = buildLogRecord(
        this.options.identity,
        {
          level: input.level,
          message: `${input.message} (log fields dropped: ${reason})`,
          context: input.context,
        },
        this.now(),
      );
      this.options.sink.write(this.formatter(record));
    } catch {
      return;
    }
  }

  debug(message: string, details?: LogDetails): void {
    this.write({ ...details, level: 'debug', message });
  }

  info(message: string, details?: LogDetails): void {
    this.write({ ...details, level: 'info', message });
  }

  warn(message: string, details?: LogDetails): void {
    this.write({ ...details, level: 'warn', message });
  }

  error(message: string, details?: LogDetails): void {
    this.write({ ...details, level: 'error', message });
  }

  async flush(): Promise<void> {
    const { shipper, flushTimeoutMs = DEFAULT_FLUSH_TIMEOUT_MS } = this.options;
    if (!shipper) {
      return;
    }
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, flushTimeoutMs);
      timer.unref();
    });
    try {
      await Promise.race([shipper.flush(), timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
