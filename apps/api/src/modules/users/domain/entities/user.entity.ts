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
  role: 'user' | 'admin';
  createdAt: Date;
  updatedAt: Date;
}
