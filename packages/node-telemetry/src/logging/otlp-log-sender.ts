import { setTimeout } from 'node:timers';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';

import type { LogIdentity, LogRecord } from './log-record';
import { buildOtlpLogsPayload } from './otlp-log-payload';

const gzipAsync = promisify(gzip);

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export type Delivery = { readonly delivered: true } | { readonly delivered: false; reason: string };

type Attempt = { kind: 'sent' } | { kind: 'failed'; reason: string; retryable: boolean };

export interface OtlpLogSenderOptions {
  readonly url: string;
  readonly identity: LogIdentity;
  readonly fetchImpl: typeof fetch;
  readonly requestTimeoutMs: number;
  readonly retryDelaysMs: readonly number[];
  readonly sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class OtlpLogSender {
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly options: OtlpLogSenderOptions) {
    this.sleep = options.sleep ?? defaultSleep;
  }

  async deliver(records: readonly LogRecord[]): Promise<Delivery> {
    const { retryDelaysMs } = this.options;
    let reason = 'unknown';
    for (let attempt = 0; attempt <= retryDelaysMs.length; attempt += 1) {
      const outcome = await this.attempt(records);
      if (outcome.kind === 'sent') {
        return { delivered: true };
      }
      reason = outcome.reason;
      if (!outcome.retryable || attempt === retryDelaysMs.length) {
        break;
      }
      await this.sleep(retryDelaysMs[attempt]);
    }
    return { delivered: false, reason };
  }

  private async attempt(records: readonly LogRecord[]): Promise<Attempt> {
    try {
      const payload = buildOtlpLogsPayload(this.options.identity, records);
      const response = await this.options.fetchImpl(this.options.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-encoding': 'gzip' },
        body: await gzipAsync(JSON.stringify(payload)),
        signal: AbortSignal.timeout(this.options.requestTimeoutMs),
      });
      await response.body?.cancel().catch(() => undefined);
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
