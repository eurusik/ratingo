import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import {
  type IObjectStorageService,
  OBJECT_STORAGE_SERVICE,
} from '../domain/services/object-storage.service.interface';

const AVATAR_CONTENT_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type AvatarContentType = keyof typeof AVATAR_CONTENT_TYPES;

/**
 * Generates presigned upload URLs for user avatars.
 */
@Injectable()
export class AvatarUploadService {
  constructor(
    @Inject(OBJECT_STORAGE_SERVICE)
    private readonly objectStorage: IObjectStorageService,
  ) {}

  /**
   * Creates a presigned upload URL for a user's avatar.
   *
   * @param {string} userId - User identifier
   * @param {AvatarContentType} contentType - Avatar content type
   * @returns {Promise<PresignedPutUrlResult>} Presigned upload URL result
   */
  async createUploadUrl(userId: string, contentType: AvatarContentType) {
    const ext = AVATAR_CONTENT_TYPES[contentType];
    const key = `avatars/${userId}/${randomUUID()}.${ext}`;

    return this.objectStorage.getPresignedPutUrl({
      key,
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
      expiresInSeconds: 300,
    });
  }
}
