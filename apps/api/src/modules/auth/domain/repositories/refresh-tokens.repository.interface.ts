/**
 * Injection token for refresh tokens repository.
 */
export const REFRESH_TOKENS_REPOSITORY = Symbol('REFRESH_TOKENS_REPOSITORY');

import { RefreshToken } from '../entities/refresh-token.entity';

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
   * Revokes all refresh tokens for a user.
   *
   * @param {string} userId - User id
   * @returns {Promise<void>} Nothing
   */
  revokeAllForUser(userId: string): Promise<void>;
}
