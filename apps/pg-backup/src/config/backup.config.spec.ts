import { loadBackupConfig } from './backup.config';

const requiredEnv = {
  BACKUP_DATABASE_URL: 'postgresql://user:pass@db:5432/app',
  AWS_ACCESS_KEY_ID: 'key',
  AWS_SECRET_ACCESS_KEY: 'secret',
  AWS_S3_BUCKET: 'bucket',
  AWS_S3_REGION: 'auto',
};

describe('loadBackupConfig', () => {
  it('names every missing required variable', () => {
    expect(() => loadBackupConfig({ AWS_S3_BUCKET: 'bucket' })).toThrow(
      'Missing required environment variables: BACKUP_DATABASE_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_REGION',
    );
  });

  it('defaults to five upload retries spread over about fifteen minutes', () => {
    expect(loadBackupConfig(requiredEnv).uploadRetryDelaysMs).toEqual([
      30_000, 60_000, 120_000, 240_000, 480_000,
    ]);
  });

  it('reads custom retry delays in seconds', () => {
    const config = loadBackupConfig({ ...requiredEnv, UPLOAD_RETRY_DELAYS_SECONDS: '1, 2' });

    expect(config.uploadRetryDelaysMs).toEqual([1000, 2000]);
  });

  it('rejects malformed retry delays', () => {
    expect(() =>
      loadBackupConfig({ ...requiredEnv, UPLOAD_RETRY_DELAYS_SECONDS: '5,abc' }),
    ).toThrow('UPLOAD_RETRY_DELAYS_SECONDS');
  });

  it('parses path style and treats an empty endpoint as unset', () => {
    const config = loadBackupConfig({
      ...requiredEnv,
      AWS_S3_FORCE_PATH_STYLE: 'true',
      AWS_S3_ENDPOINT: '',
    });

    expect(config.s3).toMatchObject({ forcePathStyle: true, endpoint: undefined });
  });

  it('names the metrics after the backup service and the Railway environment', () => {
    const config = loadBackupConfig({
      ...requiredEnv,
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://alloy.railway.internal:4318',
      RAILWAY_ENVIRONMENT_NAME: 'production',
    });

    expect(config.metrics).toEqual({
      otlpEndpoint: 'http://alloy.railway.internal:4318',
      serviceName: 'ratingo-backup',
      environmentName: 'production',
    });
  });
});
