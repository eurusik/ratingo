import type { components } from '@ratingo/api-contract';
import { apiGet, apiPatch, apiPost } from '@ratingo/web-core/api';

type UpdateProfileDto = components['schemas']['UpdateProfileDto'];

export type ProfileChanges = {
  [Field in keyof UpdateProfileDto]?: UpdateProfileDto[Field] | null;
};

export type AvatarContentType = components['schemas']['CreateAvatarUploadUrlDto']['contentType'];

type AvatarUploadUrl = components['schemas']['AvatarUploadUrlDto'];

export type LinkedAccount = components['schemas']['LinkedAccountDto'];

type PasswordChange = components['schemas']['ChangePasswordDto'];

export const accountApi = {
  updateProfile(changes: ProfileChanges): Promise<unknown> {
    return apiPatch<unknown>('users/me', changes);
  },

  createAvatarUploadUrl(contentType: AvatarContentType): Promise<AvatarUploadUrl> {
    return apiPost<AvatarUploadUrl>('users/me/avatar/upload-url', { contentType });
  },

  changePassword(change: PasswordChange): Promise<void> {
    return apiPatch<void>('auth/password', change);
  },

  linkedAccounts(): Promise<LinkedAccount[]> {
    return apiGet<LinkedAccount[]>('auth/providers');
  },
} as const;
