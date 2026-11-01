import {
  BACKUP_RESULT,
  BackupUploadError,
  DatabaseDumpError,
  type BackupOutcome,
  type DatabaseDump,
} from '../domain';
import { RunBackupUseCase } from './run-backup.use-case';

const STARTED_AT = new Date('2026-11-01T03:17:00.123Z');
const FINISHED_AT = new Date('2026-11-01T03:17:30.000Z');
const BASE_NAME = 'backup-2026-11-01T03-17-00-123Z';
const DUMP: DatabaseDump = {
  fileName: `${BASE_NAME}.tar.gz`,
  filePath: `/tmp/${BASE_NAME}.tar.gz`,
  sizeBytes: 68_000_000,
};

function setup() {
  const reported: BackupOutcome[] = [];
  const deps = {
    dumper: {
      dump: jest.fn().mockResolvedValue(DUMP),
      discard: jest.fn().mockResolvedValue(undefined),
    },
    storage: { upload: jest.fn().mockResolvedValue(undefined) },
    metrics: { report: jest.fn(async (outcome: BackupOutcome) => void reported.push(outcome)) },
    clock: { now: jest.fn().mockReturnValueOnce(STARTED_AT).mockReturnValue(FINISHED_AT) },
    sleeper: { sleep: jest.fn().mockResolvedValue(undefined) },
    logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
  };
  const useCase = new RunBackupUseCase(deps, {
    filePrefix: 'backup',
    uploadRetryDelaysMs: [30_000, 60_000],
  });
  return { useCase, deps, reported };
}

describe('RunBackupUseCase', () => {
  it('dumps under a timestamped name, uploads it and reports success', async () => {
    const { useCase, deps, reported } = setup();

    const outcome = await useCase.execute();

    expect(deps.dumper.dump).toHaveBeenCalledWith(BASE_NAME);
    expect(deps.storage.upload).toHaveBeenCalledWith(DUMP);
    expect(outcome).toEqual({
      result: BACKUP_RESULT.SUCCESS,
      objectKey: DUMP.fileName,
      sizeBytes: DUMP.sizeBytes,
      uploadAttempts: 1,
      finishedAt: FINISHED_AT,
    });
    expect(reported).toEqual([outcome]);
    expect(deps.dumper.discard).toHaveBeenCalledWith(DUMP);
  });

  it('retries a throttled upload and succeeds', async () => {
    const { useCase, deps } = setup();
    deps.storage.upload
      .mockRejectedValueOnce(new BackupUploadError('SlowDown (HTTP 503)', { retryable: true }))
      .mockResolvedValueOnce(undefined);

    const outcome = await useCase.execute();

    expect(outcome).toMatchObject({ result: BACKUP_RESULT.SUCCESS, uploadAttempts: 2 });
    expect(deps.sleeper.sleep).toHaveBeenCalledWith(30_000);
    expect(deps.logger.warn).toHaveBeenCalledWith(
      'Upload attempt 1/3 failed (SlowDown (HTTP 503)), retrying in 30s',
    );
  });

  it('reports failure with all attempts once retries run out, and still discards the dump', async () => {
    const { useCase, deps, reported } = setup();
    deps.storage.upload.mockRejectedValue(
      new BackupUploadError('EPIPE (no HTTP response): write EPIPE', { retryable: true }),
    );

    const outcome = await useCase.execute();

    expect(deps.storage.upload).toHaveBeenCalledTimes(3);
    expect(outcome).toMatchObject({
      result: BACKUP_RESULT.FAILURE,
      sizeBytes: DUMP.sizeBytes,
      uploadAttempts: 3,
      errorMessage: 'Gave up after 3 attempt(s): EPIPE (no HTTP response): write EPIPE',
    });
    expect(reported).toEqual([outcome]);
    expect(deps.dumper.discard).toHaveBeenCalledWith(DUMP);
  });

  it('fails fast on an upload error that retrying cannot fix', async () => {
    const { useCase, deps } = setup();
    deps.storage.upload.mockRejectedValue(
      new BackupUploadError('SignatureDoesNotMatch (HTTP 403)', { retryable: false }),
    );

    const outcome = await useCase.execute();

    expect(deps.storage.upload).toHaveBeenCalledTimes(1);
    expect(deps.sleeper.sleep).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ result: BACKUP_RESULT.FAILURE, uploadAttempts: 1 });
  });

  it('reports failure without uploading when the dump fails', async () => {
    const { useCase, deps } = setup();
    deps.dumper.dump.mockRejectedValue(new DatabaseDumpError(1, 'connection refused'));

    const outcome = await useCase.execute();

    expect(deps.storage.upload).not.toHaveBeenCalled();
    expect(deps.dumper.discard).not.toHaveBeenCalled();
    expect(outcome).toEqual({
      result: BACKUP_RESULT.FAILURE,
      errorMessage: 'pg_dump exited with code 1: connection refused',
      finishedAt: FINISHED_AT,
    });
  });
});
