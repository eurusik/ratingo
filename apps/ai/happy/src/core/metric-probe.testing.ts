import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';

class CollectingReader extends MetricReader {
  protected onForceFlush(): Promise<void> {
    return Promise.resolve();
  }

  protected onShutdown(): Promise<void> {
    return Promise.resolve();
  }
}

interface Point {
  value: number;
  attributes: Record<string, unknown>;
}

export const createMetricProbe = () => {
  const reader = new CollectingReader();
  const provider = new MeterProvider({ readers: [reader] });
  return {
    meter: provider.getMeter('test'),
    points: async (metricName: string): Promise<Point[]> => {
      const { resourceMetrics } = await reader.collect();
      return resourceMetrics.scopeMetrics
        .flatMap((scope) => scope.metrics)
        .filter((metric) => metric.descriptor.name === metricName)
        .flatMap((metric) => metric.dataPoints as unknown as Point[])
        .map(({ value, attributes }) => ({ value, attributes }));
    },
  };
};
