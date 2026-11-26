import { tmpdir } from 'node:os';

import { RunBackupUseCase } from './application/run-backup.use-case';
import { type BackupConfig, loadBackupConfig } from './config/backup.config';
import { BACKUP_RESULT } from './domain';
import { NoopBackupMetrics, OtlpBackupMetrics } from './infrastructure/otlp.backup-metrics';
import {
  StructuredConsole,
  type StructuredConsoleSettings,
} from './infrastructure/structured-console';
import { PgDumpDumper } from './infrastructure/pg-dump.dumper';
import { S3BackupStorage } from './infrastructure/s3.backup-storage';
import { systemClock, timerSleeper } from './infrastructure/system';

const readLoggerSettings = (env: NodeJS.ProcessEnv): StructuredConsoleSettings => ({
  service: env.OTEL_SERVICE_NAME || 'ratingo-backup',
  environment: env.RAILWAY_ENVIRONMENT_NAME || 'development',
  otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT || undefined,
});

async function main(logger: StructuredConsole, config: BackupConfig): Promise<number> {
  const { otlpEndpoint, serviceName, environmentName } = config.metrics;

  const useCase = new RunBackupUseCase(
    {
      dumper: new PgDumpDumper(config.databaseUrl, tmpdir(), logger),
      storage: S3BackupStorage.fromConfig(config.s3),
      metrics: otlpEndpoint
        ? new OtlpBackupMetrics({ endpoint: otlpEndpoint, serviceName, environmentName }, logger)
        : new NoopBackupMetrics(),
      clock: systemClock,
      sleeper: timerSleeper,
      logger,
    },
    { filePrefix: config.filePrefix, uploadRetryDelaysMs: config.uploadRetryDelaysMs },
  );

  const outcome = await useCase.execute();
  return outcome.result === BACKUP_RESULT.SUCCESS ? 0 : 1;
}

async function run(): Promise<void> {
  const logger = new StructuredConsole(readLoggerSettings(process.env));
  try {
    process.exitCode = await main(logger, loadBackupConfig());
  } catch (error) {
    logger.error('Backup could not start', error);
    process.exitCode = 1;
  } finally {
    await logger.flush();
  }
}

void run();
