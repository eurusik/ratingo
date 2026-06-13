import { Injectable, ForbiddenException, HttpStatus, Inject } from '@nestjs/common';

import { ErrorCode } from '../../../common/enums/error-code.enum';
import { AppException } from '../../../common/exceptions/app.exception';
import { UsersService } from '../../users/public';
import { type User } from '../../users/public';
import { type PasswordHasher, PASSWORD_HASHER } from '../domain/services/password-hasher.interface';
import { type AuthTokens, type ClientMeta } from '../domain/types';

import { TokenService } from './token.service';

/**
 * Credentials-based authentication use cases: registration, login, password change.
 * Token issuing lives in {@link TokenService}, OAuth flows in OAuthService.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * Registers a new user and issues tokens.
   *
   * @throws {AppException} EMAIL_ALREADY_EXISTS or USERNAME_ALREADY_EXISTS
   */
  async register(
    email: string,
    username: string,
    password: string,
    clientMeta?: ClientMeta,
  ): Promise<AuthTokens> {
    const existing = await this.usersService.getByEmail(email);
    if (existing) {
      throw new AppException(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        'Email already in use',
        HttpStatus.CONFLICT,
      );
    }
    const usernameTaken = await this.usersService.getByUsername(username);
    if (usernameTaken) {
      throw new AppException(
        ErrorCode.USERNAME_ALREADY_EXISTS,
        'Username already in use',
        HttpStatus.CONFLICT,
      );
    }

    const passwordHash = await this.passwordHasher.hash(password);
    const user = await this.usersService.createUser({
      email,
      username,
      passwordHash,
    });
    return this.tokenService.issueTokens(user, clientMeta);
  }

  /**
   * Issues tokens for an already-validated user.
   * Used after LocalStrategy has verified credentials, avoiding duplicate
   * DB queries and bcrypt comparisons.
   */
  async loginValidatedUser(user: User, clientMeta?: ClientMeta): Promise<AuthTokens> {
    return this.tokenService.issueTokens(user, clientMeta);
  }

  /**
   * Changes user password after verifying current password.
   *
   * @throws {ForbiddenException} When current password is invalid
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.usersService.getById(userId);
    if (!user || !user.passwordHash) {
      throw new ForbiddenException('Invalid credentials');
    }

    const match = await this.passwordHasher.compare(currentPassword, user.passwordHash);
    if (!match) {
      throw new ForbiddenException('Invalid credentials');
    }

    const newHash = await this.passwordHasher.hash(newPassword);
    await this.usersService.updatePassword(user.id, newHash);
  }
}
