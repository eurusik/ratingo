import type { BatchObservableCallback, Meter } from '@opentelemetry/api';

import {
  EVENT_LOOP_UTILIZATION_METRIC,
  PROCESS_CPU_TIME_METRIC,
  PROCESS_MEMORY_METRIC,
} from './constants';
import { registerRuntimeMetrics } from './runtime-metrics';

function fakeMeter() {
  let callback: BatchObservableCallback | undefined;
  const instrument = (name: string) => ({ name });
  const meter = {
    createObservableGauge: instrument,
    createObservableCounter: instrument,
    addBatchObservableCallback: (registered: BatchObservableCallback) => {
      callback = registered;
    },
  } as unknown as Meter;

  const collect = () => {
    const observed: { name: string; value: number; attributes?: Record<string, unknown> }[] = [];
    void callback?.({
      observe: (
        instrumentObserved: { name: string },
        value: number,
        attributes?: Record<string, unknown>,
      ) => observed.push({ name: instrumentObserved.name, value, attributes }),
    } as never);
    return observed;
  };
  return { meter, collect };
}

describe('registerRuntimeMetrics', () => {
  it('reports memory by type, CPU time by mode and event loop utilization on every export', () => {
    const { meter, collect } = fakeMeter();
    registerRuntimeMetrics(meter);

    const observed = collect();

    expect(
      observed
        .filter(({ name }) => name === PROCESS_MEMORY_METRIC)
        .map(({ attributes }) => attributes),
    ).toEqual([
      { type: 'rss' },
      { type: 'heap_used' },
      { type: 'heap_total' },
      { type: 'external' },
      { type: 'array_buffers' },
    ]);
    expect(
      observed
        .filter(({ name }) => name === PROCESS_CPU_TIME_METRIC)
        .map(({ attributes }) => attributes),
    ).toEqual([{ 'cpu.mode': 'user' }, { 'cpu.mode': 'system' }]);

    const [utilization] = observed.filter(({ name }) => name === EVENT_LOOP_UTILIZATION_METRIC);
    expect(utilization.value).toBeGreaterThanOrEqual(0);
    expect(utilization.value).toBeLessThanOrEqual(1);
  });

  it('reports CPU time in seconds that never decreases between exports', () => {
    const { meter, collect } = fakeMeter();
    registerRuntimeMetrics(meter);

    const userCpu = () =>
      collect().find(
        ({ name, attributes }) =>
          name === PROCESS_CPU_TIME_METRIC && attributes?.['cpu.mode'] === 'user',
      )?.value ?? -1;
    const first = userCpu();
    const second = userCpu();

    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(process.uptime() * 64);
    expect(second).toBeGreaterThanOrEqual(first);
  });
});
