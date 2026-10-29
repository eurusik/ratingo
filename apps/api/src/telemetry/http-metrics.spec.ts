import fastify, { type FastifyInstance } from 'fastify';

import { registerHttpMetrics } from './http-metrics';
import { HTTP_DURATION_BUCKETS_SECONDS, HTTP_REQUEST_DURATION_METRIC } from './telemetry.constants';
import { createTestMeterProvider } from './telemetry.testing';

describe('registerHttpMetrics', () => {
  let app: FastifyInstance;
  let collect: ReturnType<typeof createTestMeterProvider>['collect'];

  beforeEach(async () => {
    const testProvider = createTestMeterProvider();
    collect = testProvider.collect;
    app = fastify();
    registerHttpMetrics(app, testProvider.provider.getMeter('test'));
    app.get('/api/items/:id', async () => ({ ok: true }));
    app.get('/api/health', async () => ({ ok: true }));
    app.get('/api/broken', async (_request, reply) => reply.code(503).send({ ok: false }));
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('records duration with the route template, method and status code', async () => {
    await app.inject({ method: 'GET', url: '/api/items/42' });
    await app.inject({ method: 'GET', url: '/api/items/43' });
    await app.inject({ method: 'GET', url: '/api/broken' });

    const points = await collect(HTTP_REQUEST_DURATION_METRIC);

    expect(points.map((point) => point.attributes)).toEqual(
      expect.arrayContaining([
        {
          'http.request.method': 'GET',
          'http.route': '/api/items/:id',
          'http.response.status_code': 200,
        },
        {
          'http.request.method': 'GET',
          'http.route': '/api/broken',
          'http.response.status_code': 503,
        },
      ]),
    );
    const itemPoint = points.find((point) => point.attributes['http.route'] === '/api/items/:id');
    expect(itemPoint?.value).toMatchObject({ count: 2 });
  });

  it('uses second-scale bucket boundaries so request latencies spread across buckets', async () => {
    await app.inject({ method: 'GET', url: '/api/items/42' });

    const [point] = await collect(HTTP_REQUEST_DURATION_METRIC);

    expect(point.value).toMatchObject({ buckets: { boundaries: HTTP_DURATION_BUCKETS_SECONDS } });
  });

  it('labels requests without a matching route as unmatched', async () => {
    await app.inject({ method: 'GET', url: '/api/does-not-exist' });

    const points = await collect(HTTP_REQUEST_DURATION_METRIC);

    expect(points).toHaveLength(1);
    expect(points[0].attributes).toMatchObject({
      'http.route': 'unmatched',
      'http.response.status_code': 404,
    });
  });

  it('does not record health checks', async () => {
    await app.inject({ method: 'GET', url: '/api/health' });

    await expect(collect(HTTP_REQUEST_DURATION_METRIC)).resolves.toHaveLength(0);
  });
});
