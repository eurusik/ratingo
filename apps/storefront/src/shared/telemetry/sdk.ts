import { type Meter, metrics } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { type Resource, resourceFromAttributes } from '@opentelemetry/resources';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import {
  BatchSpanProcessor,
  NodeTracerProvider,
  type SpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { registerRuntimeMetrics } from '@ratingo/node-telemetry';

import { type TelemetryEnv, readTelemetryEnv } from '@/shared/config/index.server';

import { METER_NAME, METRICS_EXPORT_INTERVAL_MS } from './constants';
import { NextSpanMetricsProcessor } from './next-span-metrics';
import { SampledExportProcessor } from './sampled-export-processor';

const buildResource = (config: TelemetryEnv): Resource =>
  resourceFromAttributes({
    'service.name': config.serviceName,
    'service.version': config.serviceVersion,
    'deployment.environment.name': config.environmentName,
  });

function startMetrics(resource: Resource): Meter {
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
  return meterProvider.getMeter(METER_NAME);
}

function startTracing(resource: Resource, meter: Meter, tracesExportRatio: number): void {
  const spanProcessors: SpanProcessor[] = [new NextSpanMetricsProcessor(meter)];
  if (tracesExportRatio > 0) {
    spanProcessors.push(
      new SampledExportProcessor(
        new BatchSpanProcessor(new OTLPTraceExporter()),
        tracesExportRatio,
      ),
    );
  }
  new NodeTracerProvider({ resource, spanProcessors }).register();
}

export function startTelemetry(config: TelemetryEnv = readTelemetryEnv()): void {
  if (!config.enabled) {
    return;
  }
  const resource = buildResource(config);
  const meter = startMetrics(resource);
  startTracing(resource, meter, config.tracesExportRatio);
  registerRuntimeMetrics(meter);
}
