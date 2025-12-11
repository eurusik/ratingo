/**
 * Injection token for the Users repository.
 */
export const USERS_REPOSITORY = Symbol('USERS_REPOSITORY');

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
  findById(id: string): Promise<import('../entities/user.entity').User | null>;
  findByEmail(email: string): Promise<import('../entities/user.entity').User | null>;
  findByUsername(username: string): Promise<import('../entities/user.entity').User | null>;
  create(data: CreateUserData): Promise<import('../entities/user.entity').User>;
  updateProfile(
    id: string,
    data: UpdateUserProfileData,
  ): Promise<import('../entities/user.entity').User>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
}
