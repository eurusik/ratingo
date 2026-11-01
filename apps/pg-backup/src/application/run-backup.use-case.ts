import {
  BACKUP_RESULT,
  BackupUploadError,
  MS_PER_SECOND,
  type BackupMetrics,
  type BackupOutcome,
  type BackupStorage,
  type Clock,
  type DatabaseDump,
  type DatabaseDumper,
  type Sleeper,
} from '../domain';
import { describeError } from './describe-error';
import { RetriesExhaustedError, withRetries } from './with-retries';

const BYTES_PER_MEGABYTE = 1024 * 1024;

export interface RunBackupDependencies {
  dumper: DatabaseDumper;
  storage: BackupStorage;
  metrics: BackupMetrics;
  clock: Clock;
  sleeper: Sleeper;
  logger: Pick<Console, 'log' | 'warn' | 'error'>;
}

export interface RunBackupSettings {
  filePrefix: string;
  uploadRetryDelaysMs: readonly number[];
}

type OutcomeDetails = Omit<BackupOutcome, 'result' | 'finishedAt'>;

export class RunBackupUseCase {
  constructor(
    private readonly deps: RunBackupDependencies,
    private readonly settings: RunBackupSettings,
  ) {}

  async execute(): Promise<BackupOutcome> {
    const details: OutcomeDetails = {};
    let dump: DatabaseDump | undefined;

    try {
      dump = await this.deps.dumper.dump(this.backupBaseName());
      details.objectKey = dump.fileName;
      details.sizeBytes = dump.sizeBytes;
      this.deps.logger.log(
        `Dumped database to ${dump.fileName}: ${formatMegabytes(dump.sizeBytes)}`,
      );

      details.uploadAttempts = await this.upload(dump);
      this.deps.logger.log(`Uploaded ${dump.fileName} after ${details.uploadAttempts} attempt(s)`);

      return await this.finish(BACKUP_RESULT.SUCCESS, details);
    } catch (error) {
      return await this.fail(error, details);
    } finally {
      if (dump) await this.deps.dumper.discard(dump);
    }
  }

  private async upload(dump: DatabaseDump): Promise<number> {
    const { attempts } = await withRetries(() => this.deps.storage.upload(dump), {
      delaysMs: this.settings.uploadRetryDelaysMs,
      sleeper: this.deps.sleeper,
      isRetryable: (error) => !(error instanceof BackupUploadError) || error.retryable,
      onRetry: ({ error, attempt, maxAttempts, delayMs }) =>
        this.deps.logger.warn(
          `Upload attempt ${attempt}/${maxAttempts} failed (${describeError(error)}), retrying in ${delayMs / MS_PER_SECOND}s`,
        ),
    });
    return attempts;
  }

  private async fail(error: unknown, details: OutcomeDetails): Promise<BackupOutcome> {
    if (error instanceof RetriesExhaustedError) {
      details.uploadAttempts = error.attempts;
    }
    details.errorMessage = describeError(error);
    this.deps.logger.error(`Backup failed: ${details.errorMessage}`);
    return this.finish(BACKUP_RESULT.FAILURE, details);
  }

  private async finish(
    result: BackupOutcome['result'],
    details: OutcomeDetails,
  ): Promise<BackupOutcome> {
    const outcome = { ...details, result, finishedAt: this.deps.clock.now() };
    await this.deps.metrics.report(outcome);
    return outcome;
  }

  private backupBaseName(): string {
    const timestamp = this.deps.clock.now().toISOString().replace(/[:.]+/g, '-');
    return `${this.settings.filePrefix}-${timestamp}`;
  }
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / BYTES_PER_MEGABYTE).toFixed(2)} MB`;
}
