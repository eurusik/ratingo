import { type IntervalHistogram, monitorEventLoopDelay, performance } from 'node:perf_hooks';

import type {
  BatchObservableCallback,
  BatchObservableResult,
  Meter,
  ObservableCounter,
  ObservableGauge,
} from '@opentelemetry/api';

import {
  EVENT_LOOP_DELAY_METRIC,
  EVENT_LOOP_UTILIZATION_METRIC,
  PROCESS_CPU_TIME_METRIC,
  PROCESS_MEMORY_METRIC,
} from './metric-names';
import { NS_PER_SECOND, US_PER_SECOND } from './units';

const EVENT_LOOP_RESOLUTION_MS = 20;
const EVENT_LOOP_PERCENTILES = [50, 99] as const;

interface RuntimeInstruments {
  eventLoopDelay: ObservableGauge;
  eventLoopUtilization: ObservableGauge;
  memory: ObservableGauge;
  cpuTime: ObservableCounter;
}

const createInstruments = (meter: Meter): RuntimeInstruments => ({
  eventLoopDelay: meter.createObservableGauge(EVENT_LOOP_DELAY_METRIC, {
    description: 'Event loop delay percentiles since the previous export',
    unit: 's',
  }),
  eventLoopUtilization: meter.createObservableGauge(EVENT_LOOP_UTILIZATION_METRIC, {
    description: 'Share of time the event loop was busy since the previous export',
    unit: '1',
  }),
  memory: meter.createObservableGauge(PROCESS_MEMORY_METRIC, {
    description: 'Process memory by type',
    unit: 'By',
  }),
  cpuTime: meter.createObservableCounter(PROCESS_CPU_TIME_METRIC, {
    description: 'CPU time consumed by the process',
    unit: 's',
  }),
});

function observeEventLoopDelay(
  result: BatchObservableResult,
  gauge: ObservableGauge,
  delay: IntervalHistogram,
): void {
  if (delay.count === 0) {
    return;
  }
  EVENT_LOOP_PERCENTILES.forEach((percentile) =>
    result.observe(gauge, delay.percentile(percentile) / NS_PER_SECOND, {
      percentile: `p${percentile}`,
    }),
  );
  result.observe(gauge, delay.max / NS_PER_SECOND, { percentile: 'max' });
  delay.reset();
}

function trackEventLoopUtilization(): () => number {
  let previous = performance.eventLoopUtilization();
  return () => {
    const current = performance.eventLoopUtilization();
    const sincePrevious = performance.eventLoopUtilization(current, previous);
    previous = current;
    return sincePrevious.utilization;
  };
}

function observeMemory(result: BatchObservableResult, gauge: ObservableGauge): void {
  const memory = process.memoryUsage();
  result.observe(gauge, memory.rss, { type: 'rss' });
  result.observe(gauge, memory.heapUsed, { type: 'heap_used' });
  result.observe(gauge, memory.heapTotal, { type: 'heap_total' });
  result.observe(gauge, memory.external, { type: 'external' });
  result.observe(gauge, memory.arrayBuffers, { type: 'array_buffers' });
}

function observeCpuTime(result: BatchObservableResult, counter: ObservableCounter): void {
  const cpu = process.cpuUsage();
  result.observe(counter, cpu.user / US_PER_SECOND, { 'cpu.mode': 'user' });
  result.observe(counter, cpu.system / US_PER_SECOND, { 'cpu.mode': 'system' });
}

export function registerRuntimeMetrics(meter: Meter): () => void {
  const instruments = createInstruments(meter);
  const observables = [
    instruments.eventLoopDelay,
    instruments.eventLoopUtilization,
    instruments.memory,
    instruments.cpuTime,
  ];
  const eventLoopDelay = monitorEventLoopDelay({ resolution: EVENT_LOOP_RESOLUTION_MS });
  eventLoopDelay.enable();
  const eventLoopUtilizationSincePrevious = trackEventLoopUtilization();

  const observe: BatchObservableCallback = (result) => {
    observeEventLoopDelay(result, instruments.eventLoopDelay, eventLoopDelay);
    result.observe(instruments.eventLoopUtilization, eventLoopUtilizationSincePrevious());
    observeMemory(result, instruments.memory);
    observeCpuTime(result, instruments.cpuTime);
  };
  meter.addBatchObservableCallback(observe, observables);

  return () => {
    meter.removeBatchObservableCallback(observe, observables);
    eventLoopDelay.disable();
  };
}
