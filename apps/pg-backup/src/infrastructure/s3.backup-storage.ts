import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { readFile } from 'node:fs/promises';
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';

import { BackupUploadError, type BackupStorage, type DatabaseDump } from '../domain';
import type { BackupConfig } from '../config/backup.config';

const SDK_ATTEMPTS_PER_UPLOAD = 3;
const TOO_MANY_REQUESTS = 429;
const FIRST_SERVER_ERROR = 500;
const THROTTLING_CODES = new Set([
  'SlowDown',
  'Throttling',
  'RequestTimeout',
  'RequestTimeTooSkewed',
]);

interface S3ErrorShape {
  name?: string;
  message?: string;
  Code?: string;
  code?: string;
  $metadata?: { httpStatusCode?: number };
}

export class S3BackupStorage implements BackupStorage {
  constructor(
    private readonly client: Pick<S3Client, 'send'>,
    private readonly bucket: string,
  ) {}

  static fromConfig({
    bucket,
    region,
    endpoint,
    forcePathStyle,
    accessKeyId,
    secretAccessKey,
  }: BackupConfig['s3']): S3BackupStorage {
    const client = new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
      maxAttempts: SDK_ATTEMPTS_PER_UPLOAD,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      requestHandler: {
        httpAgent: new HttpAgent({ keepAlive: false }),
        httpsAgent: new HttpsAgent({ keepAlive: false }),
      },
    });
    return new S3BackupStorage(client, bucket);
  }

  async upload(dump: DatabaseDump): Promise<void> {
    const body = await readFile(dump.filePath);
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: dump.fileName,
          Body: body,
          ContentType: 'application/gzip',
        }),
      );
    } catch (error) {
      throw toUploadError(error as S3ErrorShape);
    }
  }
}

function toUploadError(error: S3ErrorShape): BackupUploadError {
  const status = error.$metadata?.httpStatusCode;
  const code = error.Code ?? error.code ?? error.name ?? 'UnknownError';
  const statusText = status === undefined ? 'no HTTP response' : `HTTP ${status}`;
  return new BackupUploadError(`${code} (${statusText}): ${error.message ?? ''}`.trim(), {
    retryable: isRetryable(code, status),
  });
}

function isRetryable(code: string, status: number | undefined): boolean {
  if (status === undefined) return true;
  return status === TOO_MANY_REQUESTS || status >= FIRST_SERVER_ERROR || THROTTLING_CODES.has(code);
}
