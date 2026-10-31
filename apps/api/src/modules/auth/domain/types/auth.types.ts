import { type User } from '../../../users/public';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Client metadata for token binding.
 */
export interface ClientMeta {
  userAgent: string | null;
  ip: string | null;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: User['role'];
}

export interface RefreshPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}
