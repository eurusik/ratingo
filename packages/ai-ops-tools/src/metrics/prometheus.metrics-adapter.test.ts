import { MetricsQueryError, PrometheusMetricsAdapter } from './prometheus.metrics-adapter';

const CONFIG = {
  baseUrl: 'https://grafana.example/api/datasources/proxy/uid/prom/',
  token: 't0ken',
};

const json = (status: number, body: unknown) =>
  jest.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe('PrometheusMetricsAdapter', () => {
  it('queries at the given instant with a bearer token and parses samples', async () => {
    const fetchImpl = json(200, {
      status: 'success',
      data: {
        result: [
          { metric: { queue: 'a' }, value: [1, '2.5'] },
          { metric: {}, value: [1, 'NaN'] },
        ],
      },
    });
    const samples = await new PrometheusMetricsAdapter(CONFIG, fetchImpl).instant(
      'up',
      1_700_000_000_000,
    );
    expect(samples).toEqual([{ labels: { queue: 'a' }, value: 2.5 }]);
    const [url, init] = fetchImpl.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/api/datasources/proxy/uid/prom/api/v1/query');
    expect(url.searchParams.get('time')).toBe('1700000000');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer t0ken');
  });

  it('fails clearly when Grafana is not configured', async () => {
    await expect(new PrometheusMetricsAdapter({}).instant('up', 0)).rejects.toThrow(
      'не налаштована',
    );
  });

  it('reports the status code but never the token on HTTP errors', async () => {
    const error = await new PrometheusMetricsAdapter(CONFIG, json(401, {}))
      .instant('up', 0)
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(MetricsQueryError);
    expect((error as Error).message).toContain('401');
    expect((error as Error).message).not.toContain('t0ken');
  });
});
