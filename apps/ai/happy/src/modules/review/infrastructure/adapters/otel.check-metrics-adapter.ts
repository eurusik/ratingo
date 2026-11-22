import type { Counter, Meter } from '@opentelemetry/api';

import type { CheckOutcome } from '../../domain/entities/check';
import type { CheckMetricsPort } from '../../domain/ports/check-metrics.port';

export const CHECK_METRIC_NAME = 'app.ai.happy.check.events';
export const CHECK_ID_ATTRIBUTE = 'check_id';
export const CHECK_OUTCOME_ATTRIBUTE = 'outcome';

export class OtelCheckMetricsAdapter implements CheckMetricsPort {
  private readonly counter: Counter;

  constructor(
    meter: Meter,
    private readonly knownCheckIds: ReadonlySet<string>,
  ) {
    this.counter = meter.createCounter(CHECK_METRIC_NAME, {
      description: 'Checks selected for a pull request and what they produced',
    });
  }

  record(checkId: string, outcome: CheckOutcome): void {
    if (!this.knownCheckIds.has(checkId)) return;
    this.counter.add(1, { [CHECK_ID_ATTRIBUTE]: checkId, [CHECK_OUTCOME_ATTRIBUTE]: outcome });
  }
}
