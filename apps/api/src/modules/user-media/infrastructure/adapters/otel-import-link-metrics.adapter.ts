import { Injectable } from '@nestjs/common';

import { type Counter, metrics } from '@opentelemetry/api';

import { type IImportLinkMetrics } from '@/modules/user-media/domain/ports/import-link-metrics.port';
import { type LinkPendingImportsSweepResult } from '@/modules/user-media/domain/ports/link-pending-imports-sweep.port';
import { IMPORT_LINK_SWEEP_METRIC, METER_NAME } from '@/telemetry/telemetry.constants';

@Injectable()
export class OtelImportLinkMetricsAdapter implements IImportLinkMetrics {
  private readonly sweepItems: Counter = metrics
    .getMeter(METER_NAME)
    .createCounter(IMPORT_LINK_SWEEP_METRIC, {
      description: 'Pending import items the link-pending-imports sweeper resolved, by outcome',
    });

  recordSweep({ linked, timedOut }: LinkPendingImportsSweepResult): void {
    this.sweepItems.add(linked, { outcome: 'linked' });
    this.sweepItems.add(timedOut, { outcome: 'timed_out' });
  }
}
