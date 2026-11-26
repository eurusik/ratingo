import { type Counter, type MeterProvider, metrics } from '@opentelemetry/api';

import { LOG_BYTES_METRIC, LOG_RECORDS_METRIC } from '../metric-names';

import type { LogLevel } from './log-level';

const METER_NAME = 'ratingo.logs';

export type LogOutcome =
  | 'shipped'
  | 'collapsed'
  | 'dropped_rate_limit'
  | 'dropped_daily_cap'
  | 'dropped_overflow'
  | 'dropped_export_failed';

export interface LogStats {
  record(outcome: LogOutcome, level: LogLevel, bytes: number): void;
}

interface Counters {
  readonly provider: MeterProvider;
  readonly records: Counter;
  readonly bytes: Counter;
}

function createCounters(provider: MeterProvider): Counters {
  const meter = provider.getMeter(METER_NAME);
  return {
    provider,
    records: meter.createCounter(LOG_RECORDS_METRIC, {
      description: 'Log records by what happened to them on the way to Loki',
    }),
    bytes: meter.createCounter(LOG_BYTES_METRIC, {
      unit: 'By',
      description: 'Uncompressed JSON bytes of log records by outcome',
    }),
  };
}

export function createLogMetrics(): LogStats {
  let counters: Counters | undefined;
  return {
    record: (outcome, level, size) => {
      const provider = metrics.getMeterProvider();
      if (counters?.provider !== provider) {
        counters = createCounters(provider);
      }
      counters.records.add(1, { outcome, level });
      counters.bytes.add(size, { outcome });
    },
  };
}
