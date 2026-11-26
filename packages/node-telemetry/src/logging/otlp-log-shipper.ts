import { CORRELATION_KEYS, type LogIdentity, type LogRecord } from './log-record';
import { SEVERITY_NUMBER_BY_LEVEL } from './log-level';
import type { LogShipper } from './log-shipper';

const NANOS_SUFFIX_PER_MILLI = '000000';

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const SCOPE_NAME = 'ratingo.logger';

const ATTRIBUTE_KEYS = ['context', 'error_name', ...CORRELATION_KEYS] as const;

export interface OtlpLogShipperOptions {
  readonly endpoint: string;
  readonly identity: LogIdentity;
  readonly onFailure: (reason: string, lostRecords: number) => void;
  readonly fetchImpl?: typeof fetch;
  readonly flushIntervalMs?: number;
  readonly maxBatchSize?: number;
  readonly maxQueueSize?: number;
  readonly requestTimeoutMs?: number;
  readonly retryDelaysMs?: readonly number[];
  readonly sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_FLUSH_INTERVAL_MS = 1_000;
const DEFAULT_MAX_BATCH_SIZE = 200;
const DEFAULT_MAX_QUEUE_SIZE = 5_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;
const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [250, 1_000, 3_000];

const stringAttribute = (key: string, value: string) => ({ key, value: { stringValue: value } });

const toLogRecordPayload = (record: LogRecord) => ({
  timeUnixNano: `${Date.parse(record.time)}${NANOS_SUFFIX_PER_MILLI}`,
  severityNumber: SEVERITY_NUMBER_BY_LEVEL[record.level],
  severityText: record.level,
  body: { stringValue: JSON.stringify(record) },
  attributes: ATTRIBUTE_KEYS.filter((key) => record[key] !== undefined).map((key) =>
    stringAttribute(key, String(record[key])),
  ),
});

export const buildOtlpLogsPayload = (identity: LogIdentity, records: readonly LogRecord[]) => ({
  resourceLogs: [
    {
      resource: {
        attributes: [
          stringAttribute('service.name', identity.service),
          stringAttribute('deployment.environment.name', identity.environment),
        ],
      },
      scopeLogs: [{ scope: { name: SCOPE_NAME }, logRecords: records.map(toLogRecordPayload) }],
    },
  ],
});

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class OtlpLogShipper implements LogShipper {
  private readonly url: string;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly flushIntervalMs: number;
  private readonly maxBatchSize: number;
  private readonly maxQueueSize: number;
  private readonly requestTimeoutMs: number;
  private readonly retryDelaysMs: readonly number[];
  private queue: LogRecord[] = [];
  private timer: NodeJS.Timeout | undefined;
  private pending: Promise<void> = Promise.resolve();
  private overflowed = 0;

  constructor(private readonly options: OtlpLogShipperOptions) {
    this.url = `${options.endpoint.replace(/\/+$/, '')}/v1/logs`;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxBatchSize = options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
    this.maxQueueSize = options.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  }

  enqueue(record: LogRecord): void {
    this.queue.push(record);
    if (this.queue.length > this.maxQueueSize) {
      this.queue.shift();
      this.overflowed += 1;
    }
    if (this.queue.length >= this.maxBatchSize) {
      this.schedule(0);
      return;
    }
    this.schedule(this.flushIntervalMs);
  }

  flush(): Promise<void> {
    this.clearTimer();
    return this.drain();
  }

  private schedule(delayMs: number): void {
    if (this.timer !== undefined && delayMs > 0) {
      return;
    }
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.drain();
    }, delayMs);
    this.timer.unref();
  }

  private clearTimer(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  private drain(): Promise<void> {
    this.pending = this.pending.then(() => this.sendAll());
    return this.pending;
  }

  private async sendAll(): Promise<void> {
    this.reportOverflow();
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.maxBatchSize);
      await this.sendWithRetries(batch);
    }
  }

  private reportOverflow(): void {
    if (this.overflowed === 0) {
      return;
    }
    const lost = this.overflowed;
    this.overflowed = 0;
    this.options.onFailure('export queue overflow', lost);
  }

  private async sendWithRetries(batch: readonly LogRecord[]): Promise<void> {
    const delays = this.retryDelaysMs;
    let reason = 'unknown';
    for (let attempt = 0; attempt <= delays.length; attempt += 1) {
      const outcome = await this.send(batch);
      if (outcome.kind === 'sent') {
        return;
      }
      reason = outcome.reason;
      if (!outcome.retryable || attempt === delays.length) {
        break;
      }
      await this.sleep(delays[attempt]);
    }
    this.options.onFailure(reason, batch.length);
  }

  private async send(
    batch: readonly LogRecord[],
  ): Promise<{ kind: 'sent' } | { kind: 'failed'; reason: string; retryable: boolean }> {
    try {
      const response = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(buildOtlpLogsPayload(this.options.identity, batch)),
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });
      if (response.ok) {
        return { kind: 'sent' };
      }
      return {
        kind: 'failed',
        reason: `HTTP ${response.status}`,
        retryable: RETRYABLE_STATUSES.has(response.status),
      };
    } catch (error) {
      return {
        kind: 'failed',
        reason: error instanceof Error ? error.message : String(error),
        retryable: true,
      };
    }
  }
}
