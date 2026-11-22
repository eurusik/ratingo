import type { CheckOutcome } from '../../domain/entities/check';
import type { CheckMetricsPort } from '../../domain/ports/check-metrics.port';

export class RecordingCheckMetrics implements CheckMetricsPort {
  readonly events: { checkId: string; outcome: CheckOutcome }[] = [];

  record(checkId: string, outcome: CheckOutcome): void {
    this.events.push({ checkId, outcome });
  }
}
