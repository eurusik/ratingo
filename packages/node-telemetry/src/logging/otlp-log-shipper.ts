import { clearTimeout, setTimeout } from 'node:timers';

import type { LogLevel } from './log-level';
import type { LogLimits } from './log-limits';
import type { LogIdentity, LogRecord } from './log-record';
import { OtlpLogSender } from './otlp-log-sender';
import type { LogShipper } from './log-shipper';
import type { LogOutcome, LogStats } from './log-stats';
import { RepeatCollapser } from './repeat-collapser';
import { ShipBudget } from './ship-budget';

const DROP_REASONS: Readonly<Partial<Record<LogOutcome, string>>> = {
  dropped_rate_limit: 'rate limit',
  dropped_daily_cap: 'daily cap',
  dropped_overflow: 'queue overflow',
};

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

export class OtlpLogShipper implements LogShipper {
  private readonly now: () => number;
  private readonly sender: OtlpLogSender;
  private readonly flushIntervalMs: number;
  private readonly maxBatchSize: number;
  private readonly maxQueueBytes: number;
  private readonly collapser: RepeatCollapser;
  private readonly budget: ShipBudget;
  private queue: QueuedRecord[] = [];
  private queuedBytes = 0;
  private timer: NodeJS.Timeout | undefined;
  private summaryTimer: NodeJS.Timeout | undefined;
  private pending: Promise<void> = Promise.resolve();
  private readonly droppedSinceReport = new Map<LogOutcome, number>();

  constructor(private readonly options: OtlpLogShipperOptions) {
    this.now = options.now ?? Date.now;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxBatchSize = options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
    this.maxQueueBytes = options.maxQueueBytes ?? DEFAULT_MAX_QUEUE_BYTES;
    this.sender = new OtlpLogSender({
      url: `${options.endpoint.replace(/\/+$/, '')}/v1/logs`,
      identity: options.identity,
      fetchImpl: options.fetchImpl ?? fetch,
      requestTimeoutMs: options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
      retryDelaysMs: options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS,
      sleep: options.sleep,
    });
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
      this.armSummaryTimer(nowMs);
    }
    this.schedule(this.queue.length >= this.maxBatchSize ? 0 : this.flushIntervalMs);
  }

  flush(): Promise<void> {
    this.clearTimer();
    const nowMs = this.now();
    this.admitAll(this.collapser.drainSummaries(nowMs, true), nowMs);
    return this.drain();
  }

  private armSummaryTimer(nowMs: number): void {
    const due = this.collapser.nextSummaryDueMs();
    if (this.summaryTimer !== undefined || due === undefined) {
      return;
    }
    this.summaryTimer = setTimeout(
      () => {
        this.summaryTimer = undefined;
        const tickMs = this.now();
        this.admitAll(this.collapser.drainSummaries(tickMs), tickMs);
        this.armSummaryTimer(tickMs);
        void this.drain();
      },
      Math.max(due - nowMs, 0) + 1,
    );
    this.summaryTimer.unref();
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
      this.options.onFailure(DROP_REASONS[outcome] ?? outcome, count);
    }
    this.droppedSinceReport.clear();
  }

  private async sendWithRetries(batch: readonly QueuedRecord[]): Promise<void> {
    const delivery = await this.sender.deliver(batch.map((item) => item.record));
    const outcome = delivery.delivered ? 'shipped' : 'dropped_export_failed';
    batch.forEach(({ record, bytes }) => this.countOutcome(outcome, record, bytes));
    if (!delivery.delivered) {
      this.options.onFailure(delivery.reason, batch.length);
    }
  }
}
