import { type OAuthProvider } from '../types/oauth-provider';

/**
 * Domain entity representing a linked OAuth account.
 * Part of the auth aggregate — managed by auth module's repository.
 */
export interface OAuthAccount {
  id: string;
  userId: string;
  provider: OAuthProvider;
  providerAccountId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}
