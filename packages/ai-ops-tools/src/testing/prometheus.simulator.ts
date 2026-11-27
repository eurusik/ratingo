import type { MetricSample } from '../metrics/metrics.port';

const HTTP_OK = 200;
const SECONDS_PER_MS = 1000;

export interface PrometheusAnswer {
  promql: string;
  samples: readonly MetricSample[];
}

export const createPrometheusSimulator =
  (answers: readonly PrometheusAnswer[], nowMs: number): typeof fetch =>
  async (input) => {
    const query = new URL(String(input)).searchParams.get('query') ?? '';
    const samples = answers.find((answer) => answer.promql === query)?.samples ?? [];
    const body = {
      status: 'success',
      data: {
        resultType: 'vector',
        result: samples.map((sample) => ({
          metric: sample.labels,
          value: [nowMs / SECONDS_PER_MS, String(sample.value)],
        })),
      },
    };
    return new Response(JSON.stringify(body), {
      status: HTTP_OK,
      headers: { 'content-type': 'application/json' },
    });
  };
