import { UserMediaAction } from '../entities/user-media-action.entity';

/**
 * Injection token for user media action repository.
 */
export const USER_MEDIA_ACTION_REPOSITORY = Symbol('USER_MEDIA_ACTION_REPOSITORY');

/**
 * Payload for creating a user media action.
 */
export interface CreateUserMediaActionData {
  userId: string;
  mediaItemId: string;
  action: string;
  context?: string | null;
  reasonKey?: string | null;
  payload?: Record<string, unknown> | null;
}

/**
 * Repository contract for user media action operations.
 */
export interface IUserMediaActionRepository {
  /**
   * Creates a new action event.
   *
   * @param {CreateUserMediaActionData} data - Action data
   * @returns {Promise<UserMediaAction>} Created action
   */
  create(data: CreateUserMediaActionData): Promise<UserMediaAction>;

  /**
   * Lists actions for a user.
   *
   * @param {string} userId - User identifier
   * @param {number} limit - Page size
   * @param {number} offset - Offset
   * @returns {Promise<UserMediaAction[]>} Actions
   */
  listByUser(userId: string, limit?: number, offset?: number): Promise<UserMediaAction[]>;

  /**
   * Lists actions for a specific media item by user.
   *
   * @param {string} userId - User identifier
   * @param {string} mediaItemId - Media item identifier
   * @returns {Promise<UserMediaAction[]>} Actions
   */
  listByUserAndMedia(userId: string, mediaItemId: string): Promise<UserMediaAction[]>;
}
