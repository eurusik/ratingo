/**
 * Users API client for user profile and settings endpoints.
 */

import type { components } from '@ratingo/api-contract';
import { apiPatch, apiPost } from './client';
import type { MeDto } from './auth';

export type UpdateProfileDto = components['schemas']['UpdateProfileDto'];
export type ChangePasswordDto = components['schemas']['ChangePasswordDto'];
export type CreateAvatarUploadUrlDto = components['schemas']['CreateAvatarUploadUrlDto'];
export type AvatarUploadUrlDto = components['schemas']['AvatarUploadUrlDto'];

export const usersApi = {
  /** Updates current user profile. */
  async updateProfile(data: UpdateProfileDto): Promise<MeDto> {
    return apiPatch<MeDto>('users/me', data);
  },

  /** Changes current user password. */
  async changePassword(data: ChangePasswordDto): Promise<void> {
    return apiPatch<void>('users/me/password', data);
  },

  /** Creates presigned URL for avatar upload. */
  async createAvatarUploadUrl(data: CreateAvatarUploadUrlDto): Promise<AvatarUploadUrlDto> {
    return apiPost<AvatarUploadUrlDto>('users/me/avatar/upload-url', data);
  },
} as const;
