export interface MetricSample {
  labels: Readonly<Record<string, string>>;
  value: number;
}

export interface MetricsPort {
  instant(query: string, atMs: number): Promise<MetricSample[]>;
}

export const METRICS_PORT = Symbol('METRICS_PORT');
