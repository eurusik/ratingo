import { type Meter, metrics } from '@opentelemetry/api';
import { type FastifyInstance } from 'fastify';

import {
  HEALTH_PATH_PREFIX,
  HTTP_REQUEST_DURATION_METRIC,
  METER_NAME,
  UNMATCHED_ROUTE,
} from './telemetry.constants';

const MS_PER_SECOND = 1000;

export function registerHttpMetrics(
  fastify: FastifyInstance,
  meter: Meter = metrics.getMeter(METER_NAME),
): void {
  const duration = meter.createHistogram(HTTP_REQUEST_DURATION_METRIC, {
    description: 'Duration of HTTP requests handled by the API',
    unit: 's',
  });

  fastify.addHook('onResponse', (request, reply, done) => {
    const route = request.routeOptions.url ?? UNMATCHED_ROUTE;
    if (!route.startsWith(HEALTH_PATH_PREFIX)) {
      duration.record(reply.elapsedTime / MS_PER_SECOND, {
        'http.request.method': request.method,
        'http.route': route,
        'http.response.status_code': reply.statusCode,
      });
    }
    done();
  });
}
