/**
 * User domain entity.
 */
export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string | null;
  avatarUrl: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  preferredLanguage: string | null;
  preferredRegion: string | null;
  isProfilePublic: boolean;
  showWatchHistory: boolean;
  showRatings: boolean;
  allowFollowers: boolean;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export const USER_ROLE = {
  USER: 'user',
  ADMIN: 'admin',
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

// Keep legacy compatibility with existing shape
export interface UserLegacy extends Omit<User, 'role'> {
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}
