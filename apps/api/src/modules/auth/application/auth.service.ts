import { randomUUID } from 'crypto';

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
  type IRefreshTokensRepository,
  REFRESH_TOKENS_REPOSITORY,
} from '../domain/repositories/refresh-tokens.repository.interface';
import { type PasswordHasher, PASSWORD_HASHER } from '../domain/services/password-hasher.interface';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Client metadata for token binding.
 */
export interface ClientMeta {
  userAgent: string | null;
  ip: string | null;
}

interface JwtPayload {
  sub: string;
  email: string;
  role: User['role'];
}

interface RefreshPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

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
  ) {}

  /**
   * Registers a new user and returns tokens.
   *
   * @param {string} email - User email
   * @param {string} username - Username
   * @param {string} password - Plain password
   * @param {ClientMeta} clientMeta - Client metadata for token binding
   * @returns {Promise<AuthTokens>} Access and refresh tokens
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
   * Authenticates user and returns tokens.
   *
   * @param {string} email - User email
   * @param {string} password - Plain password
   * @param {ClientMeta} clientMeta - Client metadata for token binding
   * @returns {Promise<AuthTokens>} Access and refresh tokens
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
   * Issues new tokens based on refresh token.
   *
   * @param {string} refreshToken - Provided refresh token
   * @param {ClientMeta} clientMeta - Client metadata for token binding
   * @returns {Promise<AuthTokens>} Access and refresh tokens
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
   *
   * @param {string} userId - User identifier
   * @returns {Promise<void>} Nothing
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
   * @param {string} userId - User identifier
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password to set
   * @returns {Promise<void>} Nothing
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
}
