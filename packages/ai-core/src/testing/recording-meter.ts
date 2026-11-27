import { createNoopMeter, type Attributes, type Meter } from '@opentelemetry/api';

interface RecordedPoint {
  value: number;
  attributes: Attributes;
}

export interface RecordingMeter {
  meter: Meter;
  recorded(metricName: string): readonly RecordedPoint[];
  observed(metricName: string): readonly RecordedPoint[];
}

interface Observation {
  observe(value: number, attributes?: Attributes): void;
}

type ObservationCallback = (observation: Observation) => void;

export const createRecordingMeter = (): RecordingMeter => {
  const noop = createNoopMeter();
  const points = new Map<string, RecordedPoint[]>();
  const callbacks = new Map<string, ObservationCallback[]>();
  const push = (name: string, value: number, attributes: Attributes = {}): void => {
    points.set(name, [...(points.get(name) ?? []), { value, attributes }]);
  };
  const instrument = (name: string) => ({
    add: (value: number, attributes?: Attributes) => push(name, value, attributes),
    record: (value: number, attributes?: Attributes) => push(name, value, attributes),
  });
  const meter: Meter = {
    ...noop,
    createCounter: instrument,
    createHistogram: instrument,
    createObservableGauge: (name) => ({
      addCallback: (callback) => {
        callbacks.set(name, [
          ...(callbacks.get(name) ?? []),
          callback as unknown as ObservationCallback,
        ]);
      },
      removeCallback: () => undefined,
    }),
  };
  return {
    meter,
    recorded: (metricName) => points.get(metricName) ?? [],
    observed: (metricName) => {
      const seen: RecordedPoint[] = [];
      const observation: Observation = {
        observe: (value, attributes = {}) => seen.push({ value, attributes }),
      };
      for (const callback of callbacks.get(metricName) ?? []) callback(observation);
      return seen;
    },
  };
};
