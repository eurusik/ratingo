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
        (a) => a.provider === provider && a.providerAccountId === providerAccountId,
      ) ?? null
    );
  }

  async findByUserId(userId: string): Promise<OAuthAccount[]> {
    return this.accounts.filter((a) => a.userId === userId);
  }

  async findByUserAndProvider(
    userId: string,
    provider: OAuthProvider,
  ): Promise<OAuthAccount | null> {
    return this.accounts.find((a) => a.userId === userId && a.provider === provider) ?? null;
  }

  async create(data: CreateOAuthAccountData): Promise<OAuthAccount> {
    const account: OAuthAccount = {
      id: `oauth-${this.accounts.length + 1}`,
      userId: data.userId,
      provider: data.provider,
      providerAccountId: data.providerAccountId,
      email: data.email,
      displayName: data.displayName,
      avatarUrl: data.avatarUrl,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.accounts.push(account);
    return account;
  }

  async deleteByUserAndProvider(userId: string, provider: OAuthProvider): Promise<boolean> {
    const idx = this.accounts.findIndex((a) => a.userId === userId && a.provider === provider);
    if (idx >= 0) {
      this.accounts.splice(idx, 1);
      return true;
    }
    return false;
  }

  async countByUserId(userId: string): Promise<number> {
    return this.accounts.filter((a) => a.userId === userId).length;
  }

  clear(): void {
    this.accounts = [];
  }
}
