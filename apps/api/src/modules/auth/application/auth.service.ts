import { randomUUID, randomBytes, createHmac } from 'crypto';

import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
  Inject,
} from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { MS_PER_SECOND, MS_PER_MINUTE, MS_PER_HOUR, MS_PER_DAY } from '../../../common/constants';
import { DevTiming } from '../../../common/utils/dev-timing';
import authConfig from '../../../config/auth.config';
import { UsersService } from '../../users/application/users.service';
import { type User } from '../../users/domain/entities/user.entity';
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
import {
  type IExchangeCodesRepository,
  EXCHANGE_CODES_REPOSITORY,
  ConsumeCodeFailureReason,
} from '../domain/repositories/exchange-codes.repository.interface';
import {
  type IRefreshTokensRepository,
  REFRESH_TOKENS_REPOSITORY,
} from '../domain/repositories/refresh-tokens.repository.interface';
import { type PasswordHasher, PASSWORD_HASHER } from '../domain/services/password-hasher.interface';
import {
  type AuthTokens,
  type ClientMeta,
  type JwtPayload,
  type RefreshPayload,
  type GoogleUserPayload,
} from '../domain/types';

/**
 * Application service for authentication use cases.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
    private readonly jwtService: JwtService,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    @Inject(REFRESH_TOKENS_REPOSITORY)
    private readonly refreshTokensRepository: IRefreshTokensRepository,
    @Inject(EXCHANGE_CODES_REPOSITORY)
    private readonly exchangeCodesRepository: IExchangeCodesRepository,
  ) {}

  /**
   * Registers a new user and issues tokens.
   *
   * @throws {ConflictException} When email or username already in use
   */
  async register(
    email: string,
    username: string,
    password: string,
    clientMeta?: ClientMeta,
  ): Promise<AuthTokens> {
    const existing = await this.usersService.getByEmail(email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }
    const usernameTaken = await this.usersService.getByUsername(username);
    if (usernameTaken) {
      throw new ConflictException('Username already in use');
    }

    const passwordHash = await this.passwordHasher.hash(password);
    const user = await this.usersService.createUser({
      email,
      username,
      passwordHash,
    });
    return this.issueTokens(user, clientMeta);
  }

  /**
   * Authenticates user with email/password.
   *
   * @deprecated Use {@link loginValidatedUser} after LocalStrategy validation instead.
   * Kept for backward compatibility; will be removed in a future cleanup.
   * @throws {UnauthorizedException} When credentials are invalid
   */
  async login(email: string, password: string, clientMeta?: ClientMeta): Promise<AuthTokens> {
    const user = await this.usersService.getByEmail(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const match = await this.passwordHasher.compare(password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.issueTokens(user, clientMeta);
  }

  /**
   * Issues tokens for an already-validated user.
   * Used after LocalStrategy has verified credentials, avoiding duplicate
   * DB queries and bcrypt comparisons.
   */
  async loginValidatedUser(user: User, clientMeta?: ClientMeta): Promise<AuthTokens> {
    return this.issueTokens(user, clientMeta);
  }

  /**
   * Authenticates user via Google OAuth.
   * Resolves account by: googleId → email (link) → create new.
   */
  async loginWithGoogle(
    payload: GoogleUserPayload,
    clientMeta?: ClientMeta,
  ): Promise<{ user: User; tokens: AuthTokens }> {
    // 1. Find by googleId
    let user = await this.usersService.getByGoogleId(payload.googleId);

    // 2. Find by email and link googleId
    if (!user) {
      user = await this.usersService.getByEmail(payload.email);
      if (user) {
        await this.usersService.linkGoogleId(user.id, payload.googleId);
        // Set avatarUrl only if currently null
        if (!user.avatarUrl && payload.picture) {
          await this.usersService.updateProfile(user.id, { avatarUrl: payload.picture });
        }
        // Refresh user data after updates
        user = await this.usersService.getById(user.id);
      }
    }

    // 3. Create new user
    if (!user) {
      const username = await this.generateUniqueUsername(payload.name, payload.email);
      user = await this.usersService.createUser({
        email: payload.email,
        username,
        passwordHash: null,
        googleId: payload.googleId,
        avatarUrl: payload.picture,
      });
    }

    // Issue tokens using existing method - applies same token rotation
    // and reuse detection as password-authenticated users
    const tokens = await this.issueTokens(user, clientMeta);
    return { user, tokens };
  }

  /**
   * Issues new tokens using valid refresh token.
   * Implements token rotation with reuse detection.
   *
   * @throws {UnauthorizedException} When token is invalid, expired, or reused
   */
  async refresh(refreshToken: string, clientMeta?: ClientMeta): Promise<AuthTokens> {
    const t = DevTiming.start('authRefresh');

    t.mark('before_verify');
    let payload: RefreshPayload;
    try {
      payload = await this.jwtService.verifyAsync<RefreshPayload>(refreshToken, {
        secret: this.config.refreshTokenSecret,
      });
    } catch (error) {
      this.logger.warn(`Refresh token verification failed: ${error.message}`);
      throw new UnauthorizedException('Invalid refresh token');
    }
    t.mark('after_verify');

    t.mark('before_lookup');
    const stored = await this.refreshTokensRepository.findById(payload.jti);
    t.mark('after_lookup');

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    t.mark('before_compare');
    const valid = await this.passwordHasher.compare(refreshToken, stored.tokenHash);
    t.mark('after_compare');

    if (!valid) {
      await this.refreshTokensRepository.revokeAllForUser(payload.sub);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    t.mark('before_load_user');
    const user = await this.usersService.getById(payload.sub);
    t.mark('after_load_user');

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    t.mark('before_revoke');
    // rotate: revoke old, issue new
    await this.refreshTokensRepository.revoke(stored.id);
    t.mark('after_revoke');

    t.mark('before_issue');
    const tokens = await this.issueTokens(user, clientMeta);
    t.mark('after_issue');

    t.end();

    return tokens;
  }

  /**
   * Revokes all refresh tokens for user (logout everywhere).
   */
  async logout(userId: string): Promise<void> {
    await this.refreshTokensRepository.revokeAllForUser(userId);
  }

  private async issueTokens(user: User, clientMeta?: ClientMeta): Promise<AuthTokens> {
    const accessPayload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.config.accessTokenSecret,
      expiresIn: this.config.accessTokenTtl,
    });

    const jti = randomUUID();
    const refreshPayload: RefreshPayload = { sub: user.id, jti, type: 'refresh' };
    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.config.refreshTokenSecret,
      expiresIn: this.config.refreshTokenTtl,
    });

    const refreshTokenHash = await this.passwordHasher.hash(refreshToken);
    const expiresAt = this.computeExpiry(this.config.refreshTokenTtl);

    await this.refreshTokensRepository.issue({
      id: jti,
      userId: user.id,
      tokenHash: refreshTokenHash,
      userAgent: clientMeta?.userAgent ?? null,
      ip: clientMeta?.ip ?? null,
      expiresAt,
      revokedAt: null,
    });

    return { accessToken, refreshToken };
  }

  private computeExpiry(ttl: string): Date {
    const ms = this.parseDuration(ttl);
    return new Date(Date.now() + ms);
  }

  /**
   * Changes user password after verifying current password.
   *
   * @throws {UnauthorizedException} When current password is invalid
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersService.getById(userId);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const match = await this.passwordHasher.compare(currentPassword, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const newHash = await this.passwordHasher.hash(newPassword);
    await this.usersService.updatePassword(user.id, newHash);
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
    return this.issueTokens(user, clientMeta);
  }

  private parseDuration(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) return Number(duration) || 0;
    const value = Number(match[1]);
    const unit = match[2];
    switch (unit) {
      case 's':
        return value * MS_PER_SECOND;
      case 'm':
        return value * MS_PER_MINUTE;
      case 'h':
        return value * MS_PER_HOUR;
      case 'd':
        return value * MS_PER_DAY;
      default:
        return value;
    }
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
