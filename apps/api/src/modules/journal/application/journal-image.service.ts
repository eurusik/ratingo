import { Readable } from 'node:stream';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

import {
  FeatureDisabledException,
  NotFoundException,
  ValidationException,
} from '@/common/exceptions';

import { JOURNAL_ERRORS } from '../domain/constants/journal-errors';

/**
 * Allowed image MIME types for journal uploads.
 */
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/**
 * Maximum file size for journal images (5MB).
 */
export const MAX_IMAGE_SIZE_MB = 5;
export const MAX_IMAGE_SIZE = MAX_IMAGE_SIZE_MB * 1024 * 1024;

/**
 * Maps MIME types to file extensions.
 * Safer than parsing filename extensions.
 */
export const MIME_TO_EXTENSION: Record<AllowedImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

/**
 * Maps file extensions back to MIME types for serving.
 */
export const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

/**
 * Journal images folder prefix in S3.
 */
export const JOURNAL_IMAGES_PREFIX = 'journal/';

/**
 * Generic uploaded file interface compatible with both Express/Multer and Fastify.
 */
export interface UploadedFile {
  /** MIME type of the file */
  mimetype: string;
  /** File size in bytes */
  size: number;
  /** File content as Buffer */
  buffer: Buffer;
  /** Original filename (optional) */
  filename?: string;
}

/**
 * Result of getImage operation.
 */
export interface ImageStreamResult {
  /** Readable stream of image data */
  stream: Readable;
  /** Content type (MIME) */
  contentType: string;
  /** Content length in bytes (if available) */
  contentLength?: number;
  /** ETag for caching */
  etag?: string;
}

/**
 * Service for handling journal image uploads to S3/R2.
 *
 * Uses proxy pattern for serving images:
 * - Upload stores file in S3 and returns a stable key
 * - Images are served via proxy endpoint with aggressive caching
 * - No presigned URLs = no expiration = stable markdown links
 */
@Injectable()
export class JournalImageService {
  private readonly logger = new Logger(JournalImageService.name);
  private client: S3Client | null = null;
  private configWarningLogged = false;

  constructor(private readonly config: ConfigService) {}

  /**
   * Uploads an image to S3 storage.
   *
   * @param file - The uploaded file
   * @returns The S3 key (not full URL) for the uploaded image
   * @throws ValidationException if file type or size is invalid
   * @throws FeatureDisabledException if S3 is not configured
   *
   * @example
   * const key = await service.uploadImage(file);
   * // key = "journal/550e8400-e29b-41d4-a716-446655440000.jpg"
   * // Use in markdown: ![alt](/api/journal/images/550e8400-e29b-41d4-a716-446655440000.jpg)
   */
  async uploadImage(file: UploadedFile): Promise<string> {
    this.validateFile(file);

    const bucket = this.getBucket();
    const ext = MIME_TO_EXTENSION[file.mimetype as AllowedImageType];
    const key = `${JOURNAL_IMAGES_PREFIX}${uuidv4()}.${ext}`;

    await this.getClient().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    this.logger.debug(`Uploaded journal image: ${key}`);
    return key;
  }

  /**
   * Gets an image stream from S3 for proxying.
   *
   * @param key - The S3 key (e.g., "journal/uuid.jpg")
   * @returns Stream result with metadata for response headers
   * @throws NotFoundException if image doesn't exist
   * @throws FeatureDisabledException if S3 is not configured
   */
  async getImage(key: string): Promise<ImageStreamResult> {
    // Security: only allow journal/ prefix
    if (!key.startsWith(JOURNAL_IMAGES_PREFIX)) {
      throw new NotFoundException();
    }

    const bucket = this.getBucket();

    try {
      const response = await this.getClient().send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );

      if (!response.Body) {
        throw new NotFoundException();
      }

      // S3 SDK v3 returns a Readable stream
      const stream = response.Body as Readable;

      // Determine content type from S3 metadata or fallback to extension
      const contentType = response.ContentType || this.getContentTypeFromKey(key);

      return {
        stream,
        contentType,
        contentLength: response.ContentLength,
        etag: response.ETag,
      };
    } catch (error: unknown) {
      if (this.isS3NotFoundError(error)) {
        throw new NotFoundException();
      }
      throw error;
    }
  }

  /**
   * Extracts filename from full key for use in proxy URL.
   *
   * @param key - Full S3 key (e.g., "journal/uuid.jpg")
   * @returns Filename part (e.g., "uuid.jpg")
   */
  getFilenameFromKey(key: string): string {
    return key.replace(JOURNAL_IMAGES_PREFIX, '');
  }

  /**
   * Builds full S3 key from filename.
   *
   * @param filename - Filename (e.g., "uuid.jpg")
   * @returns Full S3 key (e.g., "journal/uuid.jpg")
   */
  buildKeyFromFilename(filename: string): string {
    return `${JOURNAL_IMAGES_PREFIX}${filename}`;
  }

  /**
   * Validates the uploaded file.
   *
   * @param file - The file to validate
   * @throws ValidationException if validation fails
   */
  validateFile(file: UploadedFile): void {
    if (!this.isAllowedType(file.mimetype)) {
      throw new ValidationException('Invalid file type. Allowed: jpg, png, webp, gif', {
        code: JOURNAL_ERRORS.INVALID_IMAGE_TYPE,
        mimetype: file.mimetype,
        allowedTypes: [...ALLOWED_IMAGE_TYPES],
      });
    }

    if (file.size > MAX_IMAGE_SIZE) {
      throw new ValidationException('File too large. Max size: 5MB', {
        code: JOURNAL_ERRORS.IMAGE_TOO_LARGE,
        size: file.size,
        maxSize: MAX_IMAGE_SIZE,
      });
    }
  }

  /**
   * Checks if a MIME type is allowed.
   *
   * @param mimetype - The MIME type to check
   * @returns True if the type is allowed
   */
  isAllowedType(mimetype: string): mimetype is AllowedImageType {
    return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(mimetype);
  }

  /**
   * Gets the file extension for a given MIME type.
   *
   * @param mimetype - The MIME type
   * @returns The file extension or undefined if not allowed
   */
  getExtensionForMimetype(mimetype: string): string | undefined {
    if (!this.isAllowedType(mimetype)) {
      return undefined;
    }
    return MIME_TO_EXTENSION[mimetype];
  }

  /**
   * Gets the bucket name from config.
   *
   * @throws FeatureDisabledException if bucket is not configured
   */
  private getBucket(): string {
    const bucket = this.config.get<string>('S3_BUCKET');
    if (!bucket) {
      this.logConfigWarning();
      throw new FeatureDisabledException('Image upload is not configured', {
        hint: 'S3_BUCKET environment variable is required',
      });
    }
    return bucket;
  }

  /**
   * Determines content type from file extension in key.
   */
  private getContentTypeFromKey(key: string): string {
    const ext = key.split('.').pop()?.toLowerCase();
    return (ext && EXTENSION_TO_MIME[ext]) || 'application/octet-stream';
  }

  /**
   * Checks if error is S3 "not found" error.
   */
  private isS3NotFoundError(error: unknown): boolean {
    if (error && typeof error === 'object' && 'name' in error) {
      const { name } = error as { name: string };
      return name === 'NoSuchKey' || name === 'NotFound';
    }
    return false;
  }

  /**
   * Gets or creates an S3 client.
   *
   * @returns S3 client instance
   * @throws FeatureDisabledException when required credentials are missing
   */
  private getClient(): S3Client {
    if (this.client) return this.client;

    const region = this.config.get<string>('S3_REGION') ?? 'auto';
    const endpoint = this.config.get<string>('S3_ENDPOINT') ?? undefined;
    const accessKeyId = this.config.get<string>('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('S3_SECRET_ACCESS_KEY');

    if (!accessKeyId || !secretAccessKey) {
      this.logConfigWarning();
      throw new FeatureDisabledException('Image upload is not configured', {
        hint: 'S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY environment variables are required',
      });
    }

    this.client = new S3Client({
      region,
      endpoint,
      forcePathStyle: false, // Railway uses virtual-hosted style URLs
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
      this.logger.warn('S3 storage not configured - journal image upload feature is disabled');
      this.configWarningLogged = true;
    }
  }
}
