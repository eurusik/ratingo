/**
 * Auth API client for authentication endpoints.
 */

import type { components } from '@ratingo/api-contract';
import { apiGet, apiPost } from './client';

/** Auth tokens response. */
export type AuthTokensDto = components['schemas']['AuthTokensDto'];

/** Current user response. */
export type MeDto = components['schemas']['MeDto'];

/** Login request payload. */
export type LoginDto = components['schemas']['LoginDto'];

/** Register request payload. */
export type RegisterDto = components['schemas']['RegisterDto'];

/** Refresh token request payload. */
export interface RefreshDto {
  refreshToken: string;
}

/** Auth API methods. */
export const authApi = {
  /** Registers a new user. */
  async register(data: RegisterDto): Promise<AuthTokensDto> {
    return apiPost<AuthTokensDto>('auth/register', data);
  },

  /** Authenticates user with email/password. */
  async login(data: LoginDto): Promise<AuthTokensDto> {
    return apiPost<AuthTokensDto>('auth/login', data);
  },

  /** Refreshes tokens using refresh token. */
  async refresh(data: RefreshDto): Promise<AuthTokensDto> {
    return apiPost<AuthTokensDto>('auth/refresh', data);
  },

  /** Logs out user (revokes refresh tokens). */
  async logout(): Promise<void> {
    await apiPost<void>('auth/logout', {});
  },

  /** Gets current authenticated user. */
  async me(): Promise<MeDto> {
    return apiGet<MeDto>('auth/me');
  },
} as const;
