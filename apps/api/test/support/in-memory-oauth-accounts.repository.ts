import { type OAuthAccount } from '../../src/modules/auth/domain/entities/oauth-account.entity';
import {
  type CreateOAuthAccountData,
  type IOAuthAccountsRepository,
} from '../../src/modules/auth/domain/repositories/oauth-accounts.repository.interface';
import { type OAuthProvider } from '../../src/modules/auth/domain/types/oauth-provider';

export class InMemoryOAuthAccountsRepository implements IOAuthAccountsRepository {
  private accounts: OAuthAccount[] = [];

  async findByProviderAccount(
    provider: OAuthProvider,
    providerAccountId: string,
  ): Promise<OAuthAccount | null> {
    return (
      this.accounts.find(
        (account) =>
          account.provider === provider && account.providerAccountId === providerAccountId,
      ) ?? null
    );
  }

  async findByUserId(userId: string): Promise<OAuthAccount[]> {
    return this.accounts.filter((account) => account.userId === userId);
  }

  async findByUserAndProvider(
    userId: string,
    provider: OAuthProvider,
  ): Promise<OAuthAccount | null> {
    return (
      this.accounts.find((account) => account.userId === userId && account.provider === provider) ??
      null
    );
  }

  async create(data: CreateOAuthAccountData): Promise<OAuthAccount> {
    const now = new Date();
    const account: OAuthAccount = {
      id: `oauth-${this.accounts.length + 1}`,
      userId: data.userId,
      provider: data.provider,
      providerAccountId: data.providerAccountId,
      email: data.email,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
      createdAt: now,
      updatedAt: now,
    };
    this.accounts.push(account);
    return account;
  }

  async deleteByUserAndProvider(userId: string, provider: OAuthProvider): Promise<boolean> {
    const index = this.accounts.findIndex(
      (account) => account.userId === userId && account.provider === provider,
    );
    if (index === -1) {
      return false;
    }
    this.accounts.splice(index, 1);
    return true;
  }

  async countByUserId(userId: string): Promise<number> {
    return this.accounts.filter((account) => account.userId === userId).length;
  }

  clear(): void {
    this.accounts = [];
  }
}
