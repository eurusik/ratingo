import { randomUUID } from 'crypto';

import { Injectable, Inject, Logger, UnauthorizedException } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { MS_PER_SECOND, MS_PER_MINUTE, MS_PER_HOUR, MS_PER_DAY } from '../../../common/constants';
import { DevTiming } from '../../../common/utils/dev-timing';
import authConfig from '../../../config/auth.config';
import { UsersService } from '../../users/public';
import { type User } from '../../users/public';
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
} from '../domain/types';

/**
 * Issues, rotates and revokes JWT access/refresh token pairs.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

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
   * Issues a new access/refresh token pair and persists the hashed refresh token.
   */
  async issueTokens(user: User, clientMeta?: ClientMeta): Promise<AuthTokens> {
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
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Refresh token verification failed: ${message}`);
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

  private computeExpiry(ttl: string): Date {
    const ms = this.parseDuration(ttl);
    return new Date(Date.now() + ms);
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
