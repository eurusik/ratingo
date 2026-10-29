import { type IntervalHistogram, monitorEventLoopDelay } from 'node:perf_hooks';

import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import {
  type BatchObservableCallback,
  type Meter,
  metrics,
  type ObservableGauge,
} from '@opentelemetry/api';

import {
  EVENT_LOOP_DELAY_METRIC,
  EVENT_LOOP_PERCENTILES,
  EVENT_LOOP_RESOLUTION_MS,
  METER_NAME,
  PROCESS_MEMORY_METRIC,
} from './telemetry.constants';

const NS_PER_SECOND = 1e9;

@Injectable()
export class RuntimeMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly meter: Meter = metrics.getMeter(METER_NAME);
  private readonly eventLoopDelay: IntervalHistogram = monitorEventLoopDelay({
    resolution: EVENT_LOOP_RESOLUTION_MS,
  });
  private gauges: ObservableGauge[] = [];

  onModuleInit(): void {
    this.eventLoopDelay.enable();
    this.gauges = [
      this.meter.createObservableGauge(EVENT_LOOP_DELAY_METRIC, {
        description: 'Event loop delay percentiles since the previous export',
        unit: 's',
      }),
      this.meter.createObservableGauge(PROCESS_MEMORY_METRIC, {
        description: 'Process memory by type',
        unit: 'By',
      }),
    ];
    this.meter.addBatchObservableCallback(this.observe, this.gauges);
  }

  onModuleDestroy(): void {
    this.eventLoopDelay.disable();
    this.meter.removeBatchObservableCallback(this.observe, this.gauges);
  }

  private readonly observe: BatchObservableCallback = (result) => {
    const [delayGauge, memoryGauge] = this.gauges;
    if (this.eventLoopDelay.count > 0) {
      EVENT_LOOP_PERCENTILES.forEach((percentile) =>
        result.observe(delayGauge, this.eventLoopDelay.percentile(percentile) / NS_PER_SECOND, {
          percentile: `p${percentile}`,
        }),
      );
      result.observe(delayGauge, this.eventLoopDelay.max / NS_PER_SECOND, { percentile: 'max' });
      this.eventLoopDelay.reset();
    }

    const memory = process.memoryUsage();
    result.observe(memoryGauge, memory.rss, { type: 'rss' });
    result.observe(memoryGauge, memory.heapUsed, { type: 'heap_used' });
    result.observe(memoryGauge, memory.heapTotal, { type: 'heap_total' });
  };
}
