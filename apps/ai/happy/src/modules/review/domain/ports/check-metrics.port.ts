import type { CheckOutcome } from '../entities/check';

export const CHECK_METRICS_PORT = Symbol('CHECK_METRICS_PORT');

export interface CheckMetricsPort {
  record(checkId: string, outcome: CheckOutcome): void;
}
