import type { GrafanaConfig } from '../../../../config/config.constants';
import type { MetricSample, MetricsPort } from '../../domain/ports/metrics.port';

const QUERY_TIMEOUT_MS = 20_000;
const MS_PER_SECOND = 1000;

export class MetricsQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetricsQueryError';
  }
}

interface PrometheusReply {
  status: string;
  error?: string;
  data?: { result: { metric: Record<string, string>; value: [number, string] }[] };
}

export class PrometheusMetricsAdapter implements MetricsPort {
  constructor(
    private readonly config: GrafanaConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async instant(query: string, atMs: number): Promise<MetricSample[]> {
    const { baseUrl, token } = this.config;
    if (baseUrl === undefined || token === undefined) {
      throw new MetricsQueryError('Grafana не налаштована');
    }
    const url = new URL(`${baseUrl.replace(/\/+$/, '')}/api/v1/query`);
    url.searchParams.set('query', query);
    url.searchParams.set('time', String(atMs / MS_PER_SECOND));
    const response = await this.fetchImpl(url, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
    }).catch((error: unknown) => {
      throw new MetricsQueryError(
        `Grafana недоступна (${error instanceof Error ? error.name : 'помилка'})`,
      );
    });
    if (!response.ok) {
      throw new MetricsQueryError(`Grafana відповіла HTTP ${response.status}`);
    }
    const reply = (await response.json()) as PrometheusReply;
    if (reply.status !== 'success') {
      throw new MetricsQueryError('Grafana повернула помилку запиту');
    }
    return (reply.data?.result ?? [])
      .map((entry) => ({ labels: entry.metric, value: Number(entry.value[1]) }))
      .filter((sample) => Number.isFinite(sample.value));
  }
}
