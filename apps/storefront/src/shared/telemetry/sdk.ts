import { metrics } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import {
  BatchSpanProcessor,
  NodeTracerProvider,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-node';

import { type TelemetryEnv, readTelemetryEnv } from '@/shared/config/index.server';

import { METER_NAME, METRICS_EXPORT_INTERVAL_MS } from './constants';
import { NextSpanMetricsProcessor } from './next-span-metrics';
import { registerRuntimeMetrics } from './runtime-metrics';

const buildServiceAttributes = (config: TelemetryEnv): Record<string, string> => ({
  'service.name': config.serviceName,
  'service.version': config.serviceVersion,
  'deployment.environment.name': config.environmentName,
});

export function startTelemetry(config: TelemetryEnv = readTelemetryEnv()): MeterProvider | undefined {
  if (!config.enabled) {
    return undefined;
  }

  const resource = resourceFromAttributes(buildServiceAttributes(config));
  const meterProvider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
        exportIntervalMillis: METRICS_EXPORT_INTERVAL_MS,
      }),
    ],
  });
  metrics.setGlobalMeterProvider(meterProvider);
  const meter = meterProvider.getMeter(METER_NAME);

  const spanProcessors: SpanProcessor[] = [new NextSpanMetricsProcessor(meter)];
  if (config.exportTraces) {
    spanProcessors.push(new BatchSpanProcessor(new OTLPTraceExporter()));
  }
  new NodeTracerProvider({ resource, spanProcessors }).register();

  registerRuntimeMetrics(meter);
  return meterProvider;
}
