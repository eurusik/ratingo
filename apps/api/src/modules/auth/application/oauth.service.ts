import { randomBytes, createHmac } from 'crypto';

import {
  Injectable,
  ConflictException,
  ForbiddenException,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';

import authConfig from '../../../config/auth.config';
import { UsersService } from '../../users/public';
import { type User } from '../../users/public';
import {
  EXCHANGE_CODE_SIZE_BYTES,
  EXCHANGE_CODE_TTL_MS,
  USERNAME_MAX_BASE_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_SUFFIX_LENGTH,
  USERNAME_MAX_ATTEMPTS,
  USERNAME_FALLBACK_SUFFIX_LENGTH,
  USERNAME_RANDOM_BYTES,
  BASE_36,
} from '../auth.constants';
import { type OAuthAccount } from '../domain/entities/oauth-account.entity';
import {
  type IExchangeCodesRepository,
  EXCHANGE_CODES_REPOSITORY,
  ConsumeCodeFailureReason,
} from '../domain/repositories/exchange-codes.repository.interface';
import {
  type IOAuthAccountsRepository,
  OAUTH_ACCOUNTS_REPOSITORY,
} from '../domain/repositories/oauth-accounts.repository.interface';
import {
  type AuthTokens,
  type ClientMeta,
  type OAuthProvider,
  type OAuthUserPayload,
} from '../domain/types';

import { TokenService } from './token.service';

/**
 * OAuth use cases: provider login, account linking and one-time exchange codes.
 */
@Injectable()
export class OAuthService {
  constructor(
    private readonly usersService: UsersService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
    private readonly tokenService: TokenService,
    @Inject(EXCHANGE_CODES_REPOSITORY)
    private readonly exchangeCodesRepository: IExchangeCodesRepository,
    @Inject(OAUTH_ACCOUNTS_REPOSITORY)
    private readonly oauthAccountsRepository: IOAuthAccountsRepository,
  ) {}

  /**
   * Authenticates user via OAuth (any provider).
   * Resolves account by: provider+providerAccountId → email (auto-link) → create new.
   */
  async loginWithOAuth(
    payload: OAuthUserPayload,
    clientMeta?: ClientMeta,
  ): Promise<{ user: User; tokens: AuthTokens }> {
    // 1. Find by provider + providerAccountId in oauth_accounts
    const existingLink = await this.oauthAccountsRepository.findByProviderAccount(
      payload.provider,
      payload.providerAccountId,
    );

    let user: User | null = null;

    if (existingLink) {
      user = await this.usersService.getById(existingLink.userId);
    }

    // 2. Find by email and auto-link new provider
    if (!user) {
      user = await this.usersService.getByEmail(payload.email);
      if (user) {
        // Auto-link this provider to existing account
        await this.oauthAccountsRepository.create({
          userId: user.id,
          provider: payload.provider,
          providerAccountId: payload.providerAccountId,
          email: payload.email,
          displayName: payload.name || null,
          avatarUrl: payload.picture,
        });
        // Set avatarUrl only if currently null
        if (!user.avatarUrl && payload.picture) {
          await this.usersService.updateProfile(user.id, { avatarUrl: payload.picture });
          user = await this.usersService.getById(user.id);
        }
      }
    }

    // 3. Create new user + link provider
    if (!user) {
      const username = await this.generateUniqueUsername(payload.name, payload.email);
      user = await this.usersService.createUser({
        email: payload.email,
        username,
        passwordHash: null,
        avatarUrl: payload.picture,
      });
      await this.oauthAccountsRepository.create({
        userId: user.id,
        provider: payload.provider,
        providerAccountId: payload.providerAccountId,
        email: payload.email,
        displayName: payload.name || null,
        avatarUrl: payload.picture,
      });
    }

    if (!user) {
      throw new InternalServerErrorException('Failed to resolve user for OAuth login');
    }
    const tokens = await this.tokenService.issueTokens(user, clientMeta);
    return { user, tokens };
  }

  /**
   * Returns list of OAuth provider names linked to the user.
   */
  async getLinkedProviders(userId: string): Promise<string[]> {
    const accounts = await this.oauthAccountsRepository.findByUserId(userId);
    return accounts.map((a) => a.provider);
  }

  /**
   * Links an OAuth provider to an existing user account.
   *
   * @throws {ConflictException} When provider account is already linked to another user
   * @throws {ConflictException} When user already has this provider linked
   */
  async linkOAuthAccount(userId: string, payload: OAuthUserPayload): Promise<OAuthAccount> {
    // 1. Check if this provider+providerAccountId is already linked to ANY user
    const existingByProvider = await this.oauthAccountsRepository.findByProviderAccount(
      payload.provider,
      payload.providerAccountId,
    );
    if (existingByProvider) {
      if (existingByProvider.userId === userId) {
        throw new ConflictException('This provider account is already linked to your account');
      }
      throw new ConflictException('This provider account is already linked to another user');
    }

    // 2. Check if user already has a different account from same provider
    const existingForUser = await this.oauthAccountsRepository.findByUserAndProvider(
      userId,
      payload.provider,
    );
    if (existingForUser) {
      throw new ConflictException('You already have a different account from this provider linked');
    }

    // 3. Create the link
    return this.oauthAccountsRepository.create({
      userId,
      provider: payload.provider,
      providerAccountId: payload.providerAccountId,
      email: payload.email,
      displayName: payload.name || null,
      avatarUrl: payload.picture,
    });
  }

  /**
   * Unlinks an OAuth provider from a user account.
   * Prevents unlinking the last authentication method.
   *
   * @throws {NotFoundException} When user not found or provider not linked
   * @throws {ForbiddenException} When this would remove the last auth method
   */
  async unlinkOAuthAccount(userId: string, provider: OAuthProvider): Promise<void> {
    const user = await this.usersService.getById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const oauthCount = await this.oauthAccountsRepository.countByUserId(userId);

    // Prevent unlinking last auth method (no password + only 1 OAuth)
    if (!user.passwordHash && oauthCount <= 1) {
      throw new ForbiddenException(
        'Cannot unlink last authentication method. Set a password first.',
      );
    }

    const deleted = await this.oauthAccountsRepository.deleteByUserAndProvider(userId, provider);
    if (!deleted) {
      throw new NotFoundException('Provider not linked to this account');
    }
  }

  /**
   * Returns detailed OAuth account links for the user (for settings page).
   */
  async getLinkedAccounts(userId: string): Promise<OAuthAccount[]> {
    return this.oauthAccountsRepository.findByUserId(userId);
  }

  /**
   * Generates one-time exchange code for secure token delivery after OAuth.
   * Code is HMAC-SHA256 hashed and stored with 60s TTL.
   */
  async generateExchangeCode(userId: string, clientMeta?: ClientMeta): Promise<string> {
    // Generate random code (256 bits of entropy)
    const code = randomBytes(EXCHANGE_CODE_SIZE_BYTES).toString('base64url');

    // Hash with HMAC-SHA256 using pepper for additional security
    const codeHash = createHmac('sha256', this.config.exchangeCodePepper)
      .update(code)
      .digest('hex');

    await this.exchangeCodesRepository.create({
      codeHash,
      userId,
      expiresAt: new Date(Date.now() + EXCHANGE_CODE_TTL_MS),
      ip: clientMeta?.ip ?? null,
      userAgent: clientMeta?.userAgent ?? null,
    });

    return code;
  }

  /**
   * Exchanges one-time code for tokens. Code is consumed atomically.
   *
   * @throws {UnauthorizedException} OAUTH_EXCHANGE_EXPIRED or OAUTH_EXCHANGE_USED
   */
  async exchangeCodeForTokens(code: string, clientMeta?: ClientMeta): Promise<AuthTokens> {
    // Hash the provided code with same pepper
    const codeHash = createHmac('sha256', this.config.exchangeCodePepper)
      .update(code)
      .digest('hex');

    // Atomic consume: find valid code and mark as used in one operation
    const result = await this.exchangeCodesRepository.consumeCode(codeHash);

    if (!result.success) {
      if ('reason' in result && result.reason === ConsumeCodeFailureReason.ALREADY_USED) {
        throw new UnauthorizedException('OAUTH_EXCHANGE_USED');
      }
      throw new UnauthorizedException('OAUTH_EXCHANGE_EXPIRED');
    }

    const user = await this.usersService.getById(result.record.userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return this.tokenService.issueTokens(user, clientMeta);
  }

  /**
   * Generates unique username from Google profile name or email.
   * Normalizes to ASCII alphanumeric + underscores, adds suffix on collision.
   */
  async generateUniqueUsername(name: string, email: string): Promise<string> {
    // Normalize: ASCII alphanumeric + underscores only
    let base = this.normalizeToUsername(name);

    // Fallback to email prefix if name is empty/invalid
    if (base.length < USERNAME_MIN_LENGTH) {
      base = this.normalizeToUsername(email.split('@')[0]);
    }

    // Ultimate fallback if email prefix is also invalid
    if (base.length < USERNAME_MIN_LENGTH) {
      base = 'user';
    }

    // Truncate to leave room for suffix
    base = base.slice(0, USERNAME_MAX_BASE_LENGTH);

    // Check if base username is available
    let username = base;
    const existingUser = await this.usersService.getByUsername(username);
    if (!existingUser) {
      return username;
    }

    // Add suffix on collision
    for (let attempt = 0; attempt < USERNAME_MAX_ATTEMPTS; attempt++) {
      const suffix = this.generateBase36Suffix(USERNAME_SUFFIX_LENGTH);
      username = `${base}_${suffix}`;

      const exists = await this.usersService.getByUsername(username);
      if (!exists) {
        return username;
      }
    }

    // Ultimate fallback: fully random username
    const randomSuffix = this.generateBase36Suffix(USERNAME_FALLBACK_SUFFIX_LENGTH);
    return `user_${randomSuffix}`;
  }

  private normalizeToUsername(input: string): string {
    if (!input) return '';

    return input
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_') // Replace non-alphanumeric with underscore
      .replace(/_+/g, '_') // Collapse multiple underscores
      .replace(/^_|_$/g, ''); // Trim leading/trailing underscores
  }

  private generateBase36Suffix(length: number): string {
    // Generate enough random bytes (4 bytes = 32 bits of entropy)
    const bytes = randomBytes(USERNAME_RANDOM_BYTES);
    // Convert to BigInt and then to base36
    const num = BigInt(`0x${bytes.toString('hex')}`);
    // Convert to base36 and take required length
    return num.toString(BASE_36).slice(0, length).padStart(length, '0');
  }
}
