/**
 * Injection token for refresh tokens repository.
 */
export const REFRESH_TOKENS_REPOSITORY = Symbol('REFRESH_TOKENS_REPOSITORY');

import { type RefreshToken } from '../entities/refresh-token.entity';

/**
 * Repository contract for refresh token storage.
 */
export interface IRefreshTokensRepository {
  /**
   * Issues a new refresh token.
   *
   * @param {Omit<RefreshToken, 'createdAt'>} token - Refresh token payload
   * @returns {Promise<RefreshToken>} Created token
   */
  issue(token: Omit<RefreshToken, 'createdAt'>): Promise<RefreshToken>;

  /**
   * Finds a refresh token by id.
   *
   * @param {string} id - Token id
   * @returns {Promise<RefreshToken | null>} Token or null
   */
  findById(id: string): Promise<RefreshToken | null>;

  /**
   * Lists all valid refresh tokens for a user.
   *
   * @param {string} userId - User id
   * @returns {Promise<RefreshToken[]>} Tokens list
   */
  findValidByUser(userId: string): Promise<RefreshToken[]>;

  /**
   * Revokes a refresh token by id.
   *
   * @param {string} id - Token id
   * @returns {Promise<void>} Nothing
   */
  revoke(id: string): Promise<void>;

  /**
   * Atomically revokes a refresh token only if it is still active (not revoked).
   * Used for rotation: exactly one concurrent caller can win.
   *
   * @param {string} id - Token id
   * @returns {Promise<boolean>} True when this call revoked the token, false when it was already revoked or missing
   */
  revokeIfActive(id: string): Promise<boolean>;

  /**
   * Revokes all refresh tokens for a user.
   *
   * @param {string} userId - User id
   * @returns {Promise<void>} Nothing
   */
  revokeAllForUser(userId: string): Promise<void>;
}
