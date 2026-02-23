/**
 * Injection token for the OAuth accounts repository.
 */
export const OAUTH_ACCOUNTS_REPOSITORY = Symbol('OAUTH_ACCOUNTS_REPOSITORY');

import { type OAuthAccount } from '../entities/oauth-account.entity';
import { type OAuthProvider } from '../types/oauth-provider';

/**
 * Data shape for creating an OAuth account link.
 */
export interface CreateOAuthAccountData {
  userId: string;
  provider: OAuthProvider;
  providerAccountId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * Repository contract for OAuth account storage.
 * Part of the auth aggregate — manages multi-provider account links.
 */
export interface IOAuthAccountsRepository {
  /**
   * Finds an OAuth account by provider and provider-specific ID.
   * Used during login to find existing linked account.
   */
  findByProviderAccount(
    provider: OAuthProvider,
    providerAccountId: string,
  ): Promise<OAuthAccount | null>;

  /**
   * Finds all OAuth accounts linked to a user.
   * Used for the settings page to show linked providers.
   */
  findByUserId(userId: string): Promise<OAuthAccount[]>;

  /**
   * Finds a specific provider link for a user.
   * Used to check if a provider is already linked.
   */
  findByUserAndProvider(userId: string, provider: OAuthProvider): Promise<OAuthAccount | null>;

  /**
   * Creates a new OAuth account link.
   * @throws On unique constraint violation (duplicate link).
   */
  create(data: CreateOAuthAccountData): Promise<OAuthAccount>;

  /**
   * Removes an OAuth account link.
   * Returns true if deleted, false if not found.
   */
  deleteByUserAndProvider(userId: string, provider: OAuthProvider): Promise<boolean>;

  /**
   * Counts OAuth accounts linked to a user.
   * Used for the "last auth method" constraint.
   */
  countByUserId(userId: string): Promise<number>;
}
