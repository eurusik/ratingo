import { formatterFor } from './log-format';
import type { LoggerSettings } from './logger-settings';
import { OtlpLogShipper } from './otlp-log-shipper';
import { StructuredLogger, type LogSink } from './structured-logger';

const EXPORT_FAILURE_REPORT_INTERVAL_MS = 60_000;

const stdoutSink: LogSink = { write: (line) => void process.stdout.write(line) };

export function createStructuredLogger(
  settings: LoggerSettings,
  sink: LogSink = stdoutSink,
  now: () => Date = () => new Date(),
): StructuredLogger {
  const { identity, minLevel, otlpEndpoint } = settings;
  const formatter = formatterFor(settings.format);
  let lastFailureReportMs = 0;
  const localLogger = new StructuredLogger({ identity, minLevel, sink, formatter, now });

  const shipper = otlpEndpoint
    ? new OtlpLogShipper({
        endpoint: otlpEndpoint,
        identity,
        onFailure: (reason, lostRecords) => {
          const nowMs = now().getTime();
          if (nowMs - lastFailureReportMs < EXPORT_FAILURE_REPORT_INTERVAL_MS) {
            return;
          }
          lastFailureReportMs = nowMs;
          localLogger.warn(`Log export failed: ${reason}`, {
            context: 'LogShipper',
            fields: { lostRecords },
          });
        },
      })
    : undefined;

  return new StructuredLogger({ identity, minLevel, sink, formatter, shipper, now });
}
