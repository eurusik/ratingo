import { type Counter, metrics } from '@opentelemetry/api';

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

export function createLogMetrics(): LogStats {
  const meter = metrics.getMeter(METER_NAME);
  const records: Counter = meter.createCounter(LOG_RECORDS_METRIC, {
    description: 'Log records by what happened to them on the way to Loki',
  });
  const bytes: Counter = meter.createCounter(LOG_BYTES_METRIC, {
    unit: 'By',
    description: 'Uncompressed JSON bytes of log records by outcome',
  });
  return {
    record: (outcome, level, size) => {
      records.add(1, { outcome, level });
      bytes.add(size, { outcome });
    },
  };
}
