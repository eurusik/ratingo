import { performance, monitorEventLoopDelay, type EventLoopUtilization } from 'node:perf_hooks';

import type { BatchObservableCallback, Meter } from '@opentelemetry/api';

import {
  EVENT_LOOP_DELAY_METRIC,
  EVENT_LOOP_PERCENTILES,
  EVENT_LOOP_RESOLUTION_MS,
  EVENT_LOOP_UTILIZATION_METRIC,
  PROCESS_CPU_TIME_METRIC,
  PROCESS_MEMORY_METRIC,
} from './constants';

const NS_PER_SECOND = 1e9;
const US_PER_SECOND = 1e6;

export function registerRuntimeMetrics(meter: Meter): () => void {
  const eventLoopDelay = monitorEventLoopDelay({ resolution: EVENT_LOOP_RESOLUTION_MS });
  eventLoopDelay.enable();
  let previousUtilization: EventLoopUtilization = performance.eventLoopUtilization();

  const delayGauge = meter.createObservableGauge(EVENT_LOOP_DELAY_METRIC, {
    description: 'Event loop delay percentiles since the previous export',
    unit: 's',
  });
  const utilizationGauge = meter.createObservableGauge(EVENT_LOOP_UTILIZATION_METRIC, {
    description: 'Share of time the event loop was busy since the previous export',
    unit: '1',
  });
  const memoryGauge = meter.createObservableGauge(PROCESS_MEMORY_METRIC, {
    description: 'Process memory by type',
    unit: 'By',
  });
  const cpuCounter = meter.createObservableCounter(PROCESS_CPU_TIME_METRIC, {
    description: 'CPU time consumed by the process',
    unit: 's',
  });

  const observe: BatchObservableCallback = (result) => {
    if (eventLoopDelay.count > 0) {
      EVENT_LOOP_PERCENTILES.forEach((percentile) =>
        result.observe(delayGauge, eventLoopDelay.percentile(percentile) / NS_PER_SECOND, {
          percentile: `p${percentile}`,
        }),
      );
      result.observe(delayGauge, eventLoopDelay.max / NS_PER_SECOND, { percentile: 'max' });
      eventLoopDelay.reset();
    }

    const currentUtilization = performance.eventLoopUtilization();
    const utilization = performance.eventLoopUtilization(currentUtilization, previousUtilization);
    previousUtilization = currentUtilization;
    result.observe(utilizationGauge, utilization.utilization);

    const memory = process.memoryUsage();
    result.observe(memoryGauge, memory.rss, { type: 'rss' });
    result.observe(memoryGauge, memory.heapUsed, { type: 'heap_used' });
    result.observe(memoryGauge, memory.heapTotal, { type: 'heap_total' });
    result.observe(memoryGauge, memory.external, { type: 'external' });
    result.observe(memoryGauge, memory.arrayBuffers, { type: 'array_buffers' });

    const cpu = process.cpuUsage();
    result.observe(cpuCounter, cpu.user / US_PER_SECOND, { 'cpu.mode': 'user' });
    result.observe(cpuCounter, cpu.system / US_PER_SECOND, { 'cpu.mode': 'system' });
  };

  const observables = [delayGauge, utilizationGauge, memoryGauge, cpuCounter];
  meter.addBatchObservableCallback(observe, observables);

  return () => {
    eventLoopDelay.disable();
    meter.removeBatchObservableCallback(observe, observables);
  };
}
