export const METRICS_EXPORT_INTERVAL_MS = 60_000;

type TelemetryEnvironment = Readonly<Record<string, string | undefined>>;

export const isTelemetryEnabled = (env: TelemetryEnvironment): boolean =>
  Boolean(env.OTEL_EXPORTER_OTLP_ENDPOINT) && env.OTEL_SDK_DISABLED !== 'true';
