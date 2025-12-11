import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { UsersService } from '../../../users/application/users.service';
import { PasswordHasher, PASSWORD_HASHER } from '../../domain/services/password-hasher.interface';

/**
 * Local strategy for email/password login.
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
   * Validates credentials and returns user payload.
   *
   * @param {string} email - User email
   * @param {string} password - Plain password
   * @returns {Promise<{ id: string; email: string; role: string }>} Minimal user info
   */
  async validate(
    email: string,
    password: string,
  ): Promise<{ id: string; email: string; role: string }> {
    const user = await this.usersService.getByEmail(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const match = await this.passwordHasher.compare(password, user.passwordHash);
    if (!match) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return { id: user.id, email: user.email, role: user.role };
  }
}
