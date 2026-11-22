import { type IncomingMessage } from 'node:http';

import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  METRICS_EXPORT_INTERVAL_MS,
  isTelemetryEnabled,
  toServiceVersion,
} from '@ratingo/node-telemetry';

import { HEALTH_PATH_PREFIX, SERVICE_NAME } from './telemetry.constants';

const buildServiceAttributes = (env: NodeJS.ProcessEnv = process.env): Record<string, string> => ({
  'service.name': env.OTEL_SERVICE_NAME || SERVICE_NAME,
  'service.version': toServiceVersion(env.RAILWAY_GIT_COMMIT_SHA),
  'deployment.environment.name': env.RAILWAY_ENVIRONMENT_NAME ?? env.NODE_ENV ?? 'development',
});

const isHealthCheck = (request: IncomingMessage): boolean =>
  request.url?.startsWith(HEALTH_PATH_PREFIX) ?? false;

export function startTelemetry(env: NodeJS.ProcessEnv = process.env): NodeSDK | undefined {
  if (!isTelemetryEnabled(env)) {
    return undefined;
  }
  const sdk = new NodeSDK({
    resource: resourceFromAttributes(buildServiceAttributes(env)),
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: METRICS_EXPORT_INTERVAL_MS,
    }),
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: isHealthCheck,
        requireParentforOutgoingSpans: true,
      }),
      new UndiciInstrumentation({ requireParentforSpans: true }),
    ],
  });
  sdk.start();
  return sdk;
}
