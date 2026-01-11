import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { PRESIGNED_URL_TTL_SECONDS } from '@/common/constants';
import { FeatureDisabledException } from '@/common/exceptions';

import {
  type IObjectStorageService,
  type PresignedPutUrlResult,
} from '../../domain/services/object-storage.service.interface';

/**
 * Implements an S3-compatible object storage service.
 * Supports AWS S3 and Cloudflare R2.
 */
@Injectable()
export class S3ObjectStorageService implements IObjectStorageService {
  private readonly logger = new Logger(S3ObjectStorageService.name);
  private client: S3Client | null = null;
  private configWarningLogged = false;

  constructor(private readonly config: ConfigService) {}

  /**
   * Gets a presigned PUT URL for uploading an object to S3/R2.
   *
   * @param {object} options - Presign options
   * @returns {Promise<PresignedPutUrlResult>} Presigned upload URL and derived public URL
   * @throws {FeatureDisabledException} When required S3_* env vars are missing
   */
  async getPresignedPutUrl(options: {
    key: string;
    contentType: string;
    cacheControl?: string;
    expiresInSeconds?: number;
  }): Promise<PresignedPutUrlResult> {
    const bucket = this.config.get<string>('S3_BUCKET');
    const publicBaseUrl = this.config.get<string>('S3_PUBLIC_BASE_URL');

    if (!bucket || !publicBaseUrl) {
      this.logConfigWarning();
      throw new FeatureDisabledException('Avatar upload is not configured', {
        hint: 'S3_BUCKET and S3_PUBLIC_BASE_URL environment variables are required',
      });
    }

    const expiresIn = options.expiresInSeconds ?? PRESIGNED_URL_TTL_SECONDS;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: options.key,
      ContentType: options.contentType,
      CacheControl: options.cacheControl,
    });

    const uploadUrl = await getSignedUrl(this.getClient(), command, { expiresIn });

    const base = publicBaseUrl.endsWith('/') ? publicBaseUrl.slice(0, -1) : publicBaseUrl;
    const key = options.key.startsWith('/') ? options.key.slice(1) : options.key;

    return {
      uploadUrl,
      publicUrl: `${base}/${key}`,
      key: options.key,
    };
  }

  /**
   * Gets or creates an S3 client.
   *
   * @returns {S3Client} S3 client instance
   * @throws {FeatureDisabledException} When required credentials are missing
   */
  private getClient(): S3Client {
    if (this.client) return this.client;

    const region = this.config.get<string>('S3_REGION') ?? 'auto';
    const endpoint = this.config.get<string>('S3_ENDPOINT') ?? undefined;
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');

    if (!accessKeyId || !secretAccessKey) {
      this.logConfigWarning();
      throw new FeatureDisabledException('Avatar upload is not configured', {
        hint: 'S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY environment variables are required',
      });
    }

    this.client = new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    return this.client;
  }

  /**
   * Logs a warning about missing S3 configuration (rate-limited to once).
   */
  private logConfigWarning(): void {
    if (!this.configWarningLogged) {
      this.logger.warn('S3 storage not configured - avatar upload feature is disabled');
      this.configWarningLogged = true;
    }
  }
}
