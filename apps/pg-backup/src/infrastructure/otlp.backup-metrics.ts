import { MS_PER_SECOND, type BackupMetrics, type BackupOutcome } from '../domain';

const METRIC_PREFIX = 'app.backup';
const EXPORT_TIMEOUT_MS = 10_000;
const NANOS_PER_MILLI = 1_000_000n;

interface OtlpAttribute {
  key: string;
  value: { stringValue: string };
}

interface OtlpGauge {
  name: string;
  gauge: { dataPoints: { asDouble: number; timeUnixNano: string; attributes: OtlpAttribute[] }[] };
}

export interface OtlpMetricsSettings {
  endpoint: string;
  serviceName: string;
  environmentName: string;
}

export class OtlpBackupMetrics implements BackupMetrics {
  constructor(
    private readonly settings: OtlpMetricsSettings,
    private readonly logger: Pick<Console, 'warn'>,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async report(outcome: BackupOutcome): Promise<void> {
    const url = `${this.settings.endpoint.replace(/\/+$/, '')}/v1/metrics`;
    try {
      const response = await this.fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(this.buildPayload(outcome)),
        signal: AbortSignal.timeout(EXPORT_TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.warn(`Metrics export returned HTTP ${response.status}`);
      }
    } catch (error) {
      this.logger.warn(
        `Metrics export failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  buildPayload(outcome: BackupOutcome) {
    const timeUnixNano = (BigInt(outcome.finishedAt.getTime()) * NANOS_PER_MILLI).toString();
    const byResult = [attribute('result', outcome.result)];
    const point = (name: string, value: number, attributes: OtlpAttribute[]): OtlpGauge => ({
      name: `${METRIC_PREFIX}.${name}`,
      gauge: { dataPoints: [{ asDouble: value, timeUnixNano, attributes }] },
    });

    const gauges = [
      point('last_run_timestamp_seconds', outcome.finishedAt.getTime() / MS_PER_SECOND, byResult),
    ];
    if (outcome.sizeBytes !== undefined) {
      gauges.push(point('size_bytes', outcome.sizeBytes, []));
    }
    if (outcome.uploadAttempts !== undefined) {
      gauges.push(point('upload_attempts', outcome.uploadAttempts, byResult));
    }

    return {
      resourceMetrics: [
        {
          resource: {
            attributes: [
              attribute('service.name', this.settings.serviceName),
              attribute('deployment.environment.name', this.settings.environmentName),
            ],
          },
          scopeMetrics: [{ scope: { name: this.settings.serviceName }, metrics: gauges }],
        },
      ],
    };
  }
}

export class NoopBackupMetrics implements BackupMetrics {
  async report(): Promise<void> {}
}

function attribute(key: string, value: string): OtlpAttribute {
  return { key, value: { stringValue: value } };
}
