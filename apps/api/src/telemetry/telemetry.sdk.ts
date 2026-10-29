import { type IncomingMessage } from 'node:http';

import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';

import { type AppRole, getAppRole } from '../common/runtime/app-role';

import {
  HEALTH_PATH_PREFIX,
  METRICS_EXPORT_INTERVAL_MS,
  SERVICE_NAME_BY_ROLE,
  SHORT_COMMIT_SHA_LENGTH,
} from './telemetry.constants';

export const isTelemetryEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
  Boolean(env.OTEL_EXPORTER_OTLP_ENDPOINT) && env.OTEL_SDK_DISABLED !== 'true';

export const buildServiceAttributes = (
  role: AppRole,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string> => ({
  'service.name': env.OTEL_SERVICE_NAME || SERVICE_NAME_BY_ROLE[role],
  'service.version': env.RAILWAY_GIT_COMMIT_SHA?.slice(0, SHORT_COMMIT_SHA_LENGTH) ?? 'local',
  'deployment.environment.name': env.RAILWAY_ENVIRONMENT_NAME ?? env.NODE_ENV ?? 'development',
  'app.role': role,
});

export const isHealthCheck = (request: IncomingMessage): boolean =>
  request.url?.startsWith(HEALTH_PATH_PREFIX) ?? false;

export function startTelemetry(env: NodeJS.ProcessEnv = process.env): NodeSDK | undefined {
  if (!isTelemetryEnabled(env)) {
    return undefined;
  }

  const sdk = new NodeSDK({
    resource: resourceFromAttributes(buildServiceAttributes(getAppRole(env), env)),
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
      new IORedisInstrumentation({ requireParentSpan: true }),
      new NestInstrumentation(),
    ],
  });
  sdk.start();
  return sdk;
}
