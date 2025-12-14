import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  IObjectStorageService,
  PresignedPutUrlResult,
} from '../../domain/services/object-storage.service.interface';

/**
 * Implements an S3-compatible object storage service.
 * Supports AWS S3 and Cloudflare R2.
 */
@Injectable()
export class S3ObjectStorageService implements IObjectStorageService {
  private client: S3Client | null = null;

  constructor(private readonly config: ConfigService) {}

  /**
   * Gets a presigned PUT URL for uploading an object to S3/R2.
   *
   * @param {object} options - Presign options
   * @returns {Promise<PresignedPutUrlResult>} Presigned upload URL and derived public URL
   * @throws {ServiceUnavailableException} When required S3_* env vars are missing
   */
  async getPresignedPutUrl(options: {
    key: string;
    contentType: string;
    cacheControl?: string;
    expiresInSeconds?: number;
  }): Promise<PresignedPutUrlResult> {
    const bucket = this.config.get<string>('S3_BUCKET');
    const publicBaseUrl = this.config.get<string>('S3_PUBLIC_BASE_URL');

    if (!bucket) {
      throw new ServiceUnavailableException('S3_BUCKET is required');
    }
    if (!publicBaseUrl) {
      throw new ServiceUnavailableException('S3_PUBLIC_BASE_URL is required');
    }

    const expiresIn = options.expiresInSeconds ?? 300;

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
   * @throws {ServiceUnavailableException} When required credentials are missing
   */
  private getClient(): S3Client {
    if (this.client) return this.client;

    const region = this.config.get<string>('S3_REGION') ?? 'auto';
    const endpoint = this.config.get<string>('S3_ENDPOINT') ?? undefined;
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');

    if (!accessKeyId) {
      throw new ServiceUnavailableException('S3_ACCESS_KEY_ID is required');
    }
    if (!secretAccessKey) {
      throw new ServiceUnavailableException('S3_SECRET_ACCESS_KEY is required');
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
}
