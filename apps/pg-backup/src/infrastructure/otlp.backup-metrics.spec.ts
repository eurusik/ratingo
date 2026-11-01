import { BACKUP_RESULT, type BackupOutcome } from '../domain';
import { OtlpBackupMetrics } from './otlp.backup-metrics';

const settings = {
  endpoint: 'http://alloy:4318/',
  serviceName: 'ratingo-backup',
  environmentName: 'production',
};
const finishedAt = new Date('2026-11-01T03:17:30.000Z');
const success: BackupOutcome = {
  result: BACKUP_RESULT.SUCCESS,
  objectKey: 'backup.tar.gz',
  finishedAt,
  sizeBytes: 68_000_000,
  uploadAttempts: 2,
};

function setup(fetchImpl: jest.Mock = jest.fn().mockResolvedValue({ ok: true })) {
  const logger = { warn: jest.fn() };
  const metrics = new OtlpBackupMetrics(settings, logger, fetchImpl as unknown as typeof fetch);
  return { metrics, logger, fetchImpl };
}

function metricsIn(payload: ReturnType<OtlpBackupMetrics['buildPayload']>) {
  return payload.resourceMetrics[0].scopeMetrics[0].metrics;
}

describe('OtlpBackupMetrics', () => {
  it('describes a successful run with its timestamp, size and attempts', () => {
    const payload = setup().metrics.buildPayload(success);
    const [lastRun, size, attempts] = metricsIn(payload);
    const byResult = [{ key: 'result', value: { stringValue: 'success' } }];

    expect(lastRun).toEqual({
      name: 'app.backup.last_run_timestamp_seconds',
      gauge: {
        dataPoints: [
          { asDouble: 1_793_503_050, timeUnixNano: '1793503050000000000', attributes: byResult },
        ],
      },
    });
    expect(size.name).toBe('app.backup.size_bytes');
    expect(size.gauge.dataPoints[0]).toMatchObject({ asDouble: 68_000_000, attributes: [] });
    expect(attempts.name).toBe('app.backup.upload_attempts');
    expect(attempts.gauge.dataPoints[0]).toMatchObject({ asDouble: 2, attributes: byResult });
    expect(payload.resourceMetrics[0].resource.attributes).toEqual([
      { key: 'service.name', value: { stringValue: 'ratingo-backup' } },
      { key: 'deployment.environment.name', value: { stringValue: 'production' } },
    ]);
  });

  it('reports only the run timestamp when the dump failed', () => {
    const payload = setup().metrics.buildPayload({
      result: BACKUP_RESULT.FAILURE,
      objectKey: 'backup.tar.gz',
      finishedAt,
    });

    expect(metricsIn(payload).map((metric) => metric.name)).toEqual([
      'app.backup.last_run_timestamp_seconds',
    ]);
  });

  it('posts JSON to the OTLP metrics path', async () => {
    const { metrics, fetchImpl } = setup();

    await metrics.report(success);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://alloy:4318/v1/metrics');
    expect(init).toMatchObject({ method: 'POST', headers: { 'content-type': 'application/json' } });
    expect(JSON.parse(init.body)).toEqual(metrics.buildPayload(success));
  });

  it('logs instead of throwing when the collector is unreachable or rejects the payload', async () => {
    const unreachable = setup(jest.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const rejecting = setup(jest.fn().mockResolvedValue({ ok: false, status: 400 }));

    await expect(unreachable.metrics.report(success)).resolves.toBeUndefined();
    await expect(rejecting.metrics.report(success)).resolves.toBeUndefined();

    expect(unreachable.logger.warn).toHaveBeenCalledWith('Metrics export failed: ECONNREFUSED');
    expect(rejecting.logger.warn).toHaveBeenCalledWith('Metrics export returned HTTP 400');
  });
});
