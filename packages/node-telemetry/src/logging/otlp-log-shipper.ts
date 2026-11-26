import { promisify } from 'node:util';
import { gzip } from 'node:zlib';

import { type LogLevel, SEVERITY_NUMBER_BY_LEVEL } from './log-level';
import type { LogLimits } from './log-limits';
import { CORRELATION_KEYS, type LogIdentity, type LogRecord } from './log-record';
import type { LogShipper } from './log-shipper';
import type { LogOutcome, LogStats } from './log-stats';
import { RepeatCollapser } from './repeat-collapser';
import { ShipBudget } from './ship-budget';

const gzipAsync = promisify(gzip);

const NANOS_SUFFIX_PER_MILLI = '000000';

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const DROP_REASONS: Readonly<Partial<Record<LogOutcome, string>>> = {
  dropped_rate_limit: 'rate limit',
  dropped_daily_cap: 'daily cap',
  dropped_overflow: 'queue overflow',
};

const SCOPE_NAME = 'ratingo.logger';

const ATTRIBUTE_KEYS = ['context', 'error_name', ...CORRELATION_KEYS] as const;

const DEFAULT_FLUSH_INTERVAL_MS = 1_000;
const DEFAULT_MAX_BATCH_SIZE = 200;
const DEFAULT_MAX_QUEUE_BYTES = 2 * 1024 * 1024;
const DEFAULT_REQUEST_TIMEOUT_MS = 5_000;
const DEFAULT_RETRY_DELAYS_MS: readonly number[] = [250, 1_000, 3_000];

type ShipLimits = Pick<LogLimits, 'dedupeWindowMs' | 'maxRecordsPerMinute' | 'maxBytesPerDay'>;

interface QueuedRecord {
  readonly record: LogRecord;
  readonly bytes: number;
}

type SendOutcome = { kind: 'sent' } | { kind: 'failed'; reason: string; retryable: boolean };

export interface OtlpLogShipperOptions {
  readonly endpoint: string;
  readonly identity: LogIdentity;
  readonly limits: ShipLimits;
  readonly onFailure: (reason: string, lostRecords: number) => void;
  readonly stats?: LogStats;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly flushIntervalMs?: number;
  readonly maxBatchSize?: number;
  readonly maxQueueBytes?: number;
  readonly requestTimeoutMs?: number;
  readonly retryDelaysMs?: readonly number[];
}

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
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly flushIntervalMs: number;
  private readonly maxBatchSize: number;
  private readonly maxQueueBytes: number;
  private readonly requestTimeoutMs: number;
  private readonly retryDelaysMs: readonly number[];
  private readonly collapser: RepeatCollapser;
  private readonly budget: ShipBudget;
  private queue: QueuedRecord[] = [];
  private queuedBytes = 0;
  private timer: NodeJS.Timeout | undefined;
  private pending: Promise<void> = Promise.resolve();
  private readonly droppedSinceReport = new Map<string, number>();

  constructor(private readonly options: OtlpLogShipperOptions) {
    this.url = `${options.endpoint.replace(/\/+$/, '')}/v1/logs`;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.sleep = options.sleep ?? defaultSleep;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxBatchSize = options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
    this.maxQueueBytes = options.maxQueueBytes ?? DEFAULT_MAX_QUEUE_BYTES;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    this.collapser = new RepeatCollapser(options.limits.dedupeWindowMs);
    this.budget = new ShipBudget(options.limits);
  }

  enqueue(record: LogRecord): void {
    const nowMs = this.now();
    this.admitAll(this.collapser.drainSummaries(nowMs), nowMs);
    if (this.collapser.accept(record, nowMs)) {
      this.admit(record, nowMs);
    } else {
      this.countOutcome('collapsed', record, 0);
    }
    this.schedule(this.queue.length >= this.maxBatchSize ? 0 : this.flushIntervalMs);
  }

  flush(): Promise<void> {
    this.clearTimer();
    const nowMs = this.now();
    this.admitAll(this.collapser.drainSummaries(nowMs, true), nowMs);
    return this.drain();
  }

  private admitAll(records: readonly LogRecord[], nowMs: number): void {
    records.forEach((record) => this.admit(record, nowMs, 'error'));
  }

  private admit(record: LogRecord, nowMs: number, budgetLevel: LogLevel = record.level): void {
    const bytes = Buffer.byteLength(JSON.stringify(record));
    const verdict = this.budget.admit(budgetLevel, bytes, nowMs);
    if (verdict !== 'ok') {
      this.noteDrop(
        verdict === 'rate_limit' ? 'dropped_rate_limit' : 'dropped_daily_cap',
        record,
        bytes,
      );
      return;
    }
    this.queue.push({ record, bytes });
    this.queuedBytes += bytes;
    while (this.queuedBytes > this.maxQueueBytes && this.queue.length > 1) {
      const dropped = this.queue.shift() as QueuedRecord;
      this.queuedBytes -= dropped.bytes;
      this.noteDrop('dropped_overflow', dropped.record, dropped.bytes);
    }
  }

  private noteDrop(outcome: LogOutcome, record: LogRecord, bytes: number): void {
    this.countOutcome(outcome, record, bytes);
    this.droppedSinceReport.set(outcome, (this.droppedSinceReport.get(outcome) ?? 0) + 1);
  }

  private countOutcome(outcome: LogOutcome, record: LogRecord, bytes: number): void {
    this.options.stats?.record(outcome, record.level, bytes);
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
    this.reportDrops();
    while (this.queue.length > 0) {
      const batch = this.takeBatch();
      await this.sendWithRetries(batch);
    }
  }

  private takeBatch(): QueuedRecord[] {
    const batch = this.queue.splice(0, this.maxBatchSize);
    this.queuedBytes -= batch.reduce((sum, item) => sum + item.bytes, 0);
    return batch;
  }

  private reportDrops(): void {
    for (const [outcome, count] of this.droppedSinceReport) {
      this.options.onFailure(DROP_REASONS[outcome as LogOutcome] ?? outcome, count);
    }
    this.droppedSinceReport.clear();
  }

  private async sendWithRetries(batch: readonly QueuedRecord[]): Promise<void> {
    let reason = 'unknown';
    for (let attempt = 0; attempt <= this.retryDelaysMs.length; attempt += 1) {
      const outcome = await this.send(batch);
      if (outcome.kind === 'sent') {
        batch.forEach(({ record, bytes }) => this.countOutcome('shipped', record, bytes));
        return;
      }
      reason = outcome.reason;
      if (!outcome.retryable || attempt === this.retryDelaysMs.length) {
        break;
      }
      await this.sleep(this.retryDelaysMs[attempt]);
    }
    batch.forEach(({ record, bytes }) => this.countOutcome('dropped_export_failed', record, bytes));
    this.options.onFailure(reason, batch.length);
  }

  private async send(batch: readonly QueuedRecord[]): Promise<SendOutcome> {
    try {
      const payload = buildOtlpLogsPayload(
        this.options.identity,
        batch.map((item) => item.record),
      );
      const response = await this.fetchImpl(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' },
        body: await gzipAsync(JSON.stringify(payload)),
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
