/**
 * Auth API client for authentication endpoints.
 */

import type { components } from '@ratingo/api-contract';
import { apiGet, apiPost, apiDelete } from './client';

/** Auth tokens response. */
export type AuthTokensDto = components['schemas']['AuthTokensDto'];

/**
 * Current user response.
 *
 * Augments the generated contract type with fields that exist on the backend
 * MeDto but haven't been regenerated in the contract yet (hasPassword, linkedProviders).
 * TODO: Remove augmentation after running `npm run contracts:update`.
 */
export type MeDto = components['schemas']['MeDto'] & {
  /** Whether the user has a password set (false for OAuth-only accounts). */
  hasPassword: boolean;
  /** List of linked OAuth provider names (e.g. ['google']). */
  linkedProviders: string[];
};

/** Login request payload. */
export type LoginDto = components['schemas']['LoginDto'];

/** Register request payload. */
export type RegisterDto = components['schemas']['RegisterDto'];

/** Refresh token request payload. */
export interface RefreshDto {
  refreshToken: string;
}

/** OAuth exchange code request payload. */
export interface ExchangeCodeDto {
  code: string;
}

/** Auth configuration response. */
export interface AuthConfigDto {
  google: {
    enabled: boolean;
  };
  facebook: {
    enabled: boolean;
  };
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

  /**
   * Exchanges OAuth one-time code for tokens.
   * Used after OAuth callback to securely obtain tokens.
   *
   * @param code - One-time code from OAuth callback
   * @returns Auth tokens
   * @throws {ApiError} OAUTH_EXCHANGE_EXPIRED or OAUTH_EXCHANGE_USED
   */
  async exchangeOAuthCode(code: string): Promise<AuthTokensDto> {
    return apiPost<AuthTokensDto>('auth/oauth/exchange', { code });
  },

  /**
   * Gets auth configuration including OAuth provider status.
   * Used to conditionally show OAuth buttons.
   *
   * @returns Auth configuration with provider enabled flags
   */
  async getAuthConfig(): Promise<AuthConfigDto> {
    return apiGet<AuthConfigDto>('auth/config');
  },

  /** Unlinks an OAuth provider from the current user. */
  async unlinkProvider(provider: string): Promise<void> {
    return apiDelete<void>(`auth/providers/${provider}`);
  },
} as const;
