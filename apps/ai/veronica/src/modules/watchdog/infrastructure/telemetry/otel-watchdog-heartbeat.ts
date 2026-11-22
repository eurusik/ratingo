import { metrics, type Meter } from '@opentelemetry/api';

import { AI_METRIC_NAMES } from '@ratingo/ai-core';

import { SERVICE_NAME } from '../../../../telemetry/telemetry.constants';
import type { WatchdogHeartbeatPort } from '../../domain/ports/watchdog.ports';

const MS_PER_SECOND = 1000;

export class OtelWatchdogHeartbeat implements WatchdogHeartbeatPort {
  private lastTickSeconds: number | null = null;

  constructor(meter: Meter = metrics.getMeter(SERVICE_NAME)) {
    meter
      .createObservableGauge(AI_METRIC_NAMES.WATCHDOG_LAST_TICK, {
        description: 'Unix time of the last finished watchdog tick; absent until the first tick',
        unit: 's',
      })
      .addCallback((observation) => {
        if (this.lastTickSeconds !== null) observation.observe(this.lastTickSeconds);
      });
  }

  beat(nowMs: number): void {
    this.lastTickSeconds = Math.floor(nowMs / MS_PER_SECOND);
  }
}
