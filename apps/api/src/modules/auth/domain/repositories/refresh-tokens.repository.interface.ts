/**
 * Injection token for refresh tokens repository.
 */
export const REFRESH_TOKENS_REPOSITORY = Symbol('REFRESH_TOKENS_REPOSITORY');

import { RefreshToken } from '../entities/refresh-token.entity';

/**
 * Repository contract for refresh token storage.
 */
export interface IRefreshTokensRepository {
  issue(token: Omit<RefreshToken, 'createdAt'>): Promise<RefreshToken>;
  findById(id: string): Promise<RefreshToken | null>;
  findValidByUser(userId: string): Promise<RefreshToken[]>;
  revoke(id: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<void>;
}
