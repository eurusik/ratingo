/**
 * Injection token for the Users repository.
 */
export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

import { User } from '../entities/user.entity';

/**
 * Data shape for creating a user.
 */
export interface CreateUserData {
  email: string;
  username: string;
  passwordHash: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  preferredLanguage?: string | null;
  preferredRegion?: string | null;
  isProfilePublic?: boolean;
  showWatchHistory?: boolean;
  showRatings?: boolean;
  allowFollowers?: boolean;
  role?: 'user' | 'admin';
}

/**
 * Data shape for updating user profile (non-sensitive).
 */
export interface UpdateUserProfileData {
  avatarUrl?: string | null;
  username?: string;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  preferredLanguage?: string | null;
  preferredRegion?: string | null;
  isProfilePublic?: boolean;
  showWatchHistory?: boolean;
  showRatings?: boolean;
  allowFollowers?: boolean;
}

/**
 * Users repository contract.
 */
export interface IUsersRepository {
  /**
   * Finds a user by id.
   *
   * @param {string} id - User id
   * @returns {Promise<User | null>} User or null
   */
  findById(id: string): Promise<User | null>;

  /**
   * Finds a user by email.
   *
   * @param {string} email - Email
   * @returns {Promise<User | null>} User or null
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Finds a user by username.
   *
   * @param {string} username - Username
   * @returns {Promise<User | null>} User or null
   */
  findByUsername(username: string): Promise<User | null>;

  /**
   * Creates a new user.
   *
   * @param {CreateUserData} data - New user payload
   * @returns {Promise<User>} Created user
   */
  create(data: CreateUserData): Promise<User>;

  /**
   * Updates non-sensitive profile fields.
   *
   * @param {string} id - User id
   * @param {UpdateUserProfileData} data - Profile updates
   * @returns {Promise<User>} Updated user
   */
  updateProfile(id: string, data: UpdateUserProfileData): Promise<User>;

  /**
   * Updates password hash.
   *
   * @param {string} id - User id
   * @param {string} passwordHash - New password hash
   * @returns {Promise<void>} Nothing
   */
  updatePassword(id: string, passwordHash: string): Promise<void>;
}
