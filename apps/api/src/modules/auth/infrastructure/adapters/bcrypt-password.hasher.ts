import { Injectable, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ConfigType } from '@nestjs/config';
import { PasswordHasher } from '../../domain/services/password-hasher.interface';
import authConfig from '../../../../config/auth.config';

/**
 * Bcrypt-based password hashing adapter.
 *
 * Uses configured salt rounds from auth config.
 */
@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  constructor(
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
  ) {}

  /**
   * Hashes plaintext password.
   *
   * @param {string} plain - Raw password
   * @returns {Promise<string>} Bcrypt hash
   */
  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.config.bcryptSaltRounds);
  }

  /**
   * Compares plaintext against stored hash.
   *
   * @param {string} plain - Raw password
   * @param {string} hash - Stored bcrypt hash
   * @returns {Promise<boolean>} True if matches
   */
  async compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
