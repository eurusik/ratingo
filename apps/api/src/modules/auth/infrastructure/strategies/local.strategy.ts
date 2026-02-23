import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { Strategy } from 'passport-local';

import { UsersService } from '../../../users/application/users.service';
import { type User } from '../../../users/domain/entities/user.entity';
import {
  type PasswordHasher,
  PASSWORD_HASHER,
} from '../../domain/services/password-hasher.interface';

/**
 * Local strategy for email/password login.
 * Validates credentials and sets the full User on req.user
 * so downstream handlers can skip re-validation.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
  ) {
    super({ usernameField: 'email', passwordField: 'password' });
  }

  /**
   * Validates credentials and returns the full User entity.
   * The returned value is set on `req.user` by Passport.
   *
   * @param {string} email - User email
   * @param {string} password - Plain password
   * @returns {Promise<User>} Validated user entity
   */
  async validate(email: string, password: string): Promise<User> {
    const user = await this.usersService.getByEmail(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const match = await this.passwordHasher.compare(password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return user;
  }
}
