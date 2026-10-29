import { MeterProvider, MetricReader, type ResourceMetrics } from '@opentelemetry/sdk-metrics';

class TestMetricReader extends MetricReader {
  protected onForceFlush(): Promise<void> {
    return Promise.resolve();
  }

  protected onShutdown(): Promise<void> {
    return Promise.resolve();
  }
}

export interface CollectedPoint {
  value: unknown;
  attributes: Record<string, unknown>;
}

export const createTestMeterProvider = () => {
  const reader = new TestMetricReader();
  const provider = new MeterProvider({ readers: [reader] });

  const collect = async (metricName: string): Promise<CollectedPoint[]> => {
    const { resourceMetrics }: { resourceMetrics: ResourceMetrics } = await reader.collect();
    return resourceMetrics.scopeMetrics
      .flatMap((scope) => scope.metrics)
      .filter((metric) => metric.descriptor.name === metricName)
      .flatMap((metric) =>
        metric.dataPoints.map((point) => ({ value: point.value, attributes: point.attributes })),
      );
  };

  return { provider, collect };
};
