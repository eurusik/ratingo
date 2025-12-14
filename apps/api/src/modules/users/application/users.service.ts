import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  IUsersRepository,
  USERS_REPOSITORY,
} from '../domain/repositories/users.repository.interface';
import { User } from '../domain/entities/user.entity';
import { UserProfileVisibilityPolicy, ViewerContext } from './user-profile-visibility.policy';

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
   * Returns public-safe profile or null when not visible for the viewer.
   *
   * @param {string} username - Username
   * @param {ViewerContext | null} viewer - Optional viewer context
   * @returns {Promise<{
   *   id: string;
   *   username: string;
   *   avatarUrl: string | null;
   *   bio: string | null;
   *   location: string | null;
   *   website: string | null;
   *   createdAt: Date;
   *   privacy: {
   *     isProfilePublic: boolean;
   *     showWatchHistory: boolean;
   *     showRatings: boolean;
   *     allowFollowers: boolean;
   *   };
   * } | null>} Public profile or null
   */
  async getPublicProfileByUsername(
    username: string,
    viewer?: ViewerContext | null,
  ): Promise<{
    id: string;
    username: string;
    avatarUrl: string | null;
    bio: string | null;
    location: string | null;
    website: string | null;
    createdAt: Date;
    privacy: {
      isProfilePublic: boolean;
      showWatchHistory: boolean;
      showRatings: boolean;
      allowFollowers: boolean;
    };
  } | null> {
    const user = await this.getByUsername(username);
    if (!user) return null;

    const canView = UserProfileVisibilityPolicy.canViewProfile(user, viewer);
    if (!canView) return null;

    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      location: user.location,
      website: user.website,
      createdAt: user.createdAt,
      privacy: {
        isProfilePublic: user.isProfilePublic,
        showWatchHistory: user.showWatchHistory,
        showRatings: user.showRatings,
        allowFollowers: user.allowFollowers,
      },
    };
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
   * @param {object} payload - Profile fields
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
   * @returns {Promise<void>} Nothing
   */
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await this.usersRepository.updatePassword(id, passwordHash);
  }
}
