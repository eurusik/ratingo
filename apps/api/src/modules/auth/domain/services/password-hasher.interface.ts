/**
 * Injection token for password hasher port.
 */
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

/**
 * Password hashing/verification contract.
 */
export interface PasswordHasher {
  /**
   * Hashes a plain-text password.
   *
   * @param {string} plain - Plain password
   * @returns {Promise<string>} Password hash
   */
  hash(plain: string): Promise<string>;

  /**
   * Verifies that a plain password matches its hash.
   *
   * @param {string} plain - Plain password
   * @param {string} hash - Password hash
   * @returns {Promise<boolean>} True when password matches
   */
  compare(plain: string, hash: string): Promise<boolean>;
}
