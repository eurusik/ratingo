import { PutObjectCommand } from '@aws-sdk/client-s3';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { BackupUploadError, type DatabaseDump } from '../domain';
import { S3BackupStorage } from './s3.backup-storage';

function s3Error(code: string, message: string, httpStatusCode?: number) {
  return Object.assign(new Error(message), {
    name: code,
    Code: code,
    $metadata: { httpStatusCode },
  });
}

describe('S3BackupStorage', () => {
  let directory: string;
  let dump: DatabaseDump;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'pg-backup-'));
    dump = {
      fileName: 'backup-2026-11-01.tar.gz',
      filePath: join(directory, 'backup-2026-11-01.tar.gz'),
      sizeBytes: 5,
    };
    await writeFile(dump.filePath, 'dump!');
  });

  afterEach(() => rm(directory, { recursive: true, force: true }));

  it('puts the dump file under its file name with a buffered body', async () => {
    const send = jest.fn().mockResolvedValue({});

    await new S3BackupStorage({ send } as never, 'backups').upload(dump);

    const [command] = send.mock.calls[0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toEqual({
      Bucket: 'backups',
      Key: 'backup-2026-11-01.tar.gz',
      Body: Buffer.from('dump!'),
      ContentType: 'application/gzip',
    });
  });

  it.each([
    ['throttling', s3Error('SlowDown', 'Please reduce your request rate.', 503), true],
    ['too many requests', s3Error('TooManyRequests', 'Slow down', 429), true],
    ['a server error', s3Error('InternalError', 'oops', 500), true],
    ['a dropped connection', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }), true],
    ['bad credentials', s3Error('SignatureDoesNotMatch', 'signature mismatch', 403), false],
    ['a missing bucket', s3Error('NoSuchBucket', 'no bucket', 404), false],
  ])('marks %s as retryable=%s', async (_case, error, retryable) => {
    const send = jest.fn().mockRejectedValue(error);

    const failure = await new S3BackupStorage({ send } as never, 'backups')
      .upload(dump)
      .catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(BackupUploadError);
    expect(failure).toMatchObject({ retryable });
  });

  it('describes the error code and HTTP status', async () => {
    const send = jest
      .fn()
      .mockRejectedValue(s3Error('SlowDown', 'Please reduce your request rate.', 503));

    await expect(new S3BackupStorage({ send } as never, 'backups').upload(dump)).rejects.toThrow(
      'SlowDown (HTTP 503): Please reduce your request rate.',
    );
  });

  it('says when no HTTP response arrived', async () => {
    const send = jest
      .fn()
      .mockRejectedValue(Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }));

    await expect(new S3BackupStorage({ send } as never, 'backups').upload(dump)).rejects.toThrow(
      'EPIPE (no HTTP response): write EPIPE',
    );
  });
});
