import { tmpdir } from 'node:os';

import { RunBackupUseCase } from './application/run-backup.use-case';
import { loadBackupConfig } from './config/backup.config';
import { BACKUP_RESULT } from './domain';
import { NoopBackupMetrics, OtlpBackupMetrics } from './infrastructure/otlp.backup-metrics';
import { PgDumpDumper } from './infrastructure/pg-dump.dumper';
import { S3BackupStorage } from './infrastructure/s3.backup-storage';
import { systemClock, timerSleeper } from './infrastructure/system';

async function main(): Promise<number> {
  const config = loadBackupConfig();
  const logger = console;
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

main().then(
  (exitCode) => {
    process.exitCode = exitCode;
  },
  (error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  },
);
