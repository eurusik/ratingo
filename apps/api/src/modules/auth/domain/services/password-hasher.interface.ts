/**
 * Injection token for password hasher port.
 */
export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

/**
 * Password hashing/verification contract.
 */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}
