import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IUsersRepository,
  USERS_REPOSITORY,
} from '../domain/repositories/users.repository.interface';
import { User } from '../domain/entities/user.entity';

/**
 * Application service for user-related use cases.
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: IUsersRepository,
  ) {}

  /**
   * Gets user by ID.
   *
   * @param {string} id - User identifier
   * @returns {Promise<User | null>} User or null
   */
  async getById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  /**
   * Gets user by email.
   *
   * @param {string} email - Email address
   * @returns {Promise<User | null>} User or null
   */
  async getByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email);
  }

  /**
   * Gets user by username.
   *
   * @param {string} username - Username
   * @returns {Promise<User | null>} User or null
   */
  async getByUsername(username: string): Promise<User | null> {
    return this.usersRepository.findByUsername(username);
  }

  /**
   * Creates a new user.
   *
   * @param {Pick<User, 'email' | 'username'> & { passwordHash: string | null; avatarUrl?: string | null }} data - Creation payload
   * @returns {Promise<User>} Created user
   */
  async createUser(
    data: Pick<User, 'email' | 'username'> & {
      passwordHash: string | null;
      avatarUrl?: string | null;
    },
  ): Promise<User> {
    this.logger.debug(`Creating user ${data.email}`);
    return this.usersRepository.create({
      email: data.email,
      username: data.username,
      passwordHash: data.passwordHash,
      avatarUrl: data.avatarUrl,
    });
  }

  /**
   * Updates user profile (non-sensitive fields).
   *
   * @param {string} id - User identifier
   * @param {{
   *   avatarUrl?: string | null;
   *   username?: string;
   *   bio?: string | null;
   *   location?: string | null;
   *   website?: string | null;
   *   preferredLanguage?: string | null;
   *   preferredRegion?: string | null;
   *   isProfilePublic?: boolean;
   *   showWatchHistory?: boolean;
   *   showRatings?: boolean;
   *   allowFollowers?: boolean;
   * }} payload - Profile fields
   * @returns {Promise<User>} Updated user
   */
  async updateProfile(
    id: string,
    payload: {
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
    },
  ): Promise<User> {
    return this.usersRepository.updateProfile(id, payload);
  }

  /**
   * Updates user password hash.
   *
   * @param {string} id - User identifier
   * @param {string} passwordHash - Hashed password
   * @returns {Promise<void>}
   */
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.usersRepository.updatePassword(id, passwordHash);
  }
}
