import { formatterFor } from './log-format';
import { createLogMetrics } from './log-stats';
import type { LoggerSettings } from './logger-settings';
import { OtlpLogShipper } from './otlp-log-shipper';
import { StructuredLogger, type LogSink } from './structured-logger';

const EXPORT_FAILURE_REPORT_INTERVAL_MS = 60_000;

const stdoutSink: LogSink = { write: (line) => void process.stdout.write(line) };

function createShipper(
  settings: LoggerSettings,
  endpoint: string,
  now: () => Date,
  reportFailure: (message: string, fields: Record<string, unknown>) => void,
): OtlpLogShipper {
  let lastFailureReportMs = 0;
  return new OtlpLogShipper({
    endpoint,
    identity: settings.identity,
    limits: settings.limits,
    stats: createLogMetrics(),
    now: () => now().getTime(),
    onFailure: (reason, lostRecords) => {
      const nowMs = now().getTime();
      if (nowMs - lastFailureReportMs < EXPORT_FAILURE_REPORT_INTERVAL_MS) {
        return;
      }
      lastFailureReportMs = nowMs;
      reportFailure(`Log records dropped: ${reason}`, { lostRecords });
    },
  });
}

export function createStructuredLogger(
  settings: LoggerSettings,
  sink: LogSink = stdoutSink,
  now: () => Date = () => new Date(),
): StructuredLogger {
  const base = {
    identity: settings.identity,
    minLevel: settings.minLevel,
    sink,
    formatter: formatterFor(settings.format),
    now,
    maxRecordBytes: settings.limits.maxRecordBytes,
  };
  const localLogger = new StructuredLogger(base);
  const shipper = settings.otlpEndpoint
    ? createShipper(settings, settings.otlpEndpoint, now, (message, fields) =>
        localLogger.warn(message, { context: 'LogShipper', fields }),
      )
    : undefined;
  return new StructuredLogger({ ...base, shipper });
}
