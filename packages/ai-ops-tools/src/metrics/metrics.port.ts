export interface MetricSample {
  labels: Readonly<Record<string, string>>;
  value: number;
}

export interface MetricsPort {
  instant(query: string, atMs: number): Promise<MetricSample[]>;
}
