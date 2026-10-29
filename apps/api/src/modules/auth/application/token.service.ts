import { createHash, randomUUID, timingSafeEqual } from 'crypto';

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

/** Prefix shared by all bcrypt hashes ($2a$, $2b$, $2y$). */
const BCRYPT_HASH_PREFIX = '$2';

/** Replays of a token revoked less than this long ago are treated as client races, not theft. */
const REUSE_GRACE_PERIOD_MS = 30_000;

/**
 * Hashes a refresh token with SHA-256 (hex). bcrypt only covers the first 72 bytes, which
 * for a JWT is just the header and the start of the payload, so it cannot bind the signature.
 */
function sha256Hex(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

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

    const refreshTokenHash = sha256Hex(refreshToken);
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

    if (!stored) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    if (stored.revokedAt) {
      // Replay shortly after rotation is usually a benign client race (two tabs, a retry
      // after a lost response): reject it without killing every session.
      if (Date.now() - stored.revokedAt.getTime() < REUSE_GRACE_PERIOD_MS) {
        throw new UnauthorizedException('Refresh token expired or revoked');
      }
      // A long-revoked token is being replayed: assume theft and kill every session
      await this.refreshTokensRepository.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Refresh token reuse detected');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

    t.mark('before_compare');
    const valid = await this.matchesStoredHash(refreshToken, stored.tokenHash);
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
    // rotate: atomically revoke old (only one concurrent caller can win), issue new
    const revoked = await this.refreshTokensRepository.revokeIfActive(stored.id);
    t.mark('after_revoke');

    if (!revoked) {
      // Lost a concurrent race for the same token: only one caller gets a new pair
      throw new UnauthorizedException('Refresh token expired or revoked');
    }

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

  /**
   * Compares token against stored hash. New tokens use SHA-256 hex; legacy rows are bcrypt.
   */
  private async matchesStoredHash(refreshToken: string, storedHash: string): Promise<boolean> {
    if (storedHash.startsWith(BCRYPT_HASH_PREFIX)) {
      return this.passwordHasher.compare(refreshToken, storedHash);
    }
    const expected = Buffer.from(storedHash, 'utf8');
    const actual = Buffer.from(sha256Hex(refreshToken), 'utf8');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
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
