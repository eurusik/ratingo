import { HttpStatus, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';

import { API_KEY_STATUS } from '../../domain/constants/api-key-status.const';
import { MONITORED_PROVIDER } from '../../domain/constants/monitored-provider.const';
import { type KeyProbeResult } from '../../domain/ports/key-probe.port';

import { BaseKeyProbe } from './base-key-probe';

@Injectable()
export class S3KeyProbe extends BaseKeyProbe implements OnModuleDestroy {
  readonly provider = MONITORED_PROVIDER.S3;
  private client: S3Client | null = null;

  constructor(private readonly config: ConfigService) {
    super();
  }

  async onModuleDestroy(): Promise<void> {
    this.client?.destroy();
  }

  protected async execute(): Promise<KeyProbeResult> {
    const bucket = this.config.get<string>('S3_BUCKET');
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');

    if (!bucket || !accessKeyId || !secretAccessKey) {
      return { status: API_KEY_STATUS.UNKNOWN, detail: 'S3 credentials not configured' };
    }

    try {
      await this.getClient(accessKeyId, secretAccessKey).send(
        new HeadBucketCommand({ Bucket: bucket }),
      );
      return { status: API_KEY_STATUS.VALID };
    } catch (error) {
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
        ?.httpStatusCode;
      const detail = error instanceof Error ? error.message : 'S3 HeadBucket failed';

      if (statusCode === HttpStatus.UNAUTHORIZED || statusCode === HttpStatus.FORBIDDEN) {
        return { status: API_KEY_STATUS.INVALID, statusCode, detail: 'S3 denied access' };
      }
      if (statusCode === HttpStatus.NOT_FOUND) {
        return { status: API_KEY_STATUS.UNKNOWN, statusCode, detail: 'Bucket not found' };
      }
      return { status: API_KEY_STATUS.UNKNOWN, statusCode: statusCode ?? null, detail };
    }
  }

  private getClient(accessKeyId: string, secretAccessKey: string): S3Client {
    if (this.client) return this.client;

    this.client = new S3Client({
      region: this.config.get<string>('S3_REGION') ?? 'auto',
      endpoint: this.config.get<string>('S3_ENDPOINT') ?? undefined,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    });
    return this.client;
  }
}
