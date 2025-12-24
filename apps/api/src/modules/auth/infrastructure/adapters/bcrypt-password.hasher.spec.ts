import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { BcryptPasswordHasher } from './bcrypt-password.hasher';
import authConfig from '../../../../config/auth.config';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt');
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('BcryptPasswordHasher', () => {
  let hasher: BcryptPasswordHasher;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forFeature(authConfig)],
      providers: [
        BcryptPasswordHasher,
        {
          provide: authConfig.KEY,
          useValue: {
            bcryptSaltRounds: 10,
          },
        },
      ],
    }).compile();

    hasher = module.get<BcryptPasswordHasher>(BcryptPasswordHasher);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('hash', () => {
    it('should hash password with configured salt rounds', async () => {
      const plainPassword = 'testPassword123';
      const hashedPassword = '$2b$10$hashedPassword';

      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const result = await hasher.hash(plainPassword);

      expect(bcrypt.hash).toHaveBeenCalledWith(plainPassword, 10);
      expect(result).toBe(hashedPassword);
    });

    it('should handle empty password', async () => {
      const emptyPassword = '';
      const hashedPassword = '$2b$10$emptyHash';

      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const result = await hasher.hash(emptyPassword);

      expect(bcrypt.hash).toHaveBeenCalledWith(emptyPassword, 10);
      expect(result).toBe(hashedPassword);
    });

    it('should handle very long passwords', async () => {
      const longPassword = 'a'.repeat(1000);
      const hashedPassword = '$2b$10$longPasswordHash';

      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const result = await hasher.hash(longPassword);

      expect(bcrypt.hash).toHaveBeenCalledWith(longPassword, 10);
      expect(result).toBe(hashedPassword);
    });

    it('should handle special characters in password', async () => {
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const hashedPassword = '$2b$10$specialHash';

      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const result = await hasher.hash(specialPassword);

      expect(bcrypt.hash).toHaveBeenCalledWith(specialPassword, 10);
      expect(result).toBe(hashedPassword);
    });

    it('should handle unicode characters in password', async () => {
      const unicodePassword = 'пароль123🔒';
      const hashedPassword = '$2b$10$unicodeHash';

      mockedBcrypt.hash.mockResolvedValue(hashedPassword as never);

      const result = await hasher.hash(unicodePassword);

      expect(bcrypt.hash).toHaveBeenCalledWith(unicodePassword, 10);
      expect(result).toBe(hashedPassword);
    });

    it('should propagate bcrypt errors', async () => {
      const plainPassword = 'testPassword123';
      const error = new Error('Bcrypt error');

      mockedBcrypt.hash.mockRejectedValue(error as never);

      await expect(hasher.hash(plainPassword)).rejects.toThrow('Bcrypt error');
    });
  });

  describe('compare', () => {
    it('should return true for matching password and hash', async () => {
      const plainPassword = 'testPassword123';
      const hash = '$2b$10$validHash';

      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await hasher.compare(plainPassword, hash);

      expect(bcrypt.compare).toHaveBeenCalledWith(plainPassword, hash);
      expect(result).toBe(true);
    });

    it('should return false for non-matching password and hash', async () => {
      const plainPassword = 'wrongPassword';
      const hash = '$2b$10$validHash';

      mockedBcrypt.compare.mockResolvedValue(false as never);

      const result = await hasher.compare(plainPassword, hash);

      expect(bcrypt.compare).toHaveBeenCalledWith(plainPassword, hash);
      expect(result).toBe(false);
    });

    it('should handle empty password comparison', async () => {
      const emptyPassword = '';
      const hash = '$2b$10$validHash';

      mockedBcrypt.compare.mockResolvedValue(false as never);

      const result = await hasher.compare(emptyPassword, hash);

      expect(bcrypt.compare).toHaveBeenCalledWith(emptyPassword, hash);
      expect(result).toBe(false);
    });

    it('should handle empty hash comparison', async () => {
      const plainPassword = 'testPassword123';
      const emptyHash = '';

      mockedBcrypt.compare.mockResolvedValue(false as never);

      const result = await hasher.compare(plainPassword, emptyHash);

      expect(bcrypt.compare).toHaveBeenCalledWith(plainPassword, emptyHash);
      expect(result).toBe(false);
    });

    it('should handle invalid hash format', async () => {
      const plainPassword = 'testPassword123';
      const invalidHash = 'not-a-valid-hash';

      mockedBcrypt.compare.mockResolvedValue(false as never);

      const result = await hasher.compare(plainPassword, invalidHash);

      expect(bcrypt.compare).toHaveBeenCalledWith(plainPassword, invalidHash);
      expect(result).toBe(false);
    });

    it('should handle special characters in password comparison', async () => {
      const specialPassword = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const hash = '$2b$10$validHash';

      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await hasher.compare(specialPassword, hash);

      expect(bcrypt.compare).toHaveBeenCalledWith(specialPassword, hash);
      expect(result).toBe(true);
    });

    it('should handle unicode characters in password comparison', async () => {
      const unicodePassword = 'пароль123🔒';
      const hash = '$2b$10$validHash';

      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await hasher.compare(unicodePassword, hash);

      expect(bcrypt.compare).toHaveBeenCalledWith(unicodePassword, hash);
      expect(result).toBe(true);
    });

    it('should handle case sensitivity correctly', async () => {
      const password1 = 'TestPassword123';
      const password2 = 'testpassword123';
      const hash = '$2b$10$validHash';

      // First call returns true, second returns false
      mockedBcrypt.compare
        .mockResolvedValueOnce(true as never)
        .mockResolvedValueOnce(false as never);

      const result1 = await hasher.compare(password1, hash);
      const result2 = await hasher.compare(password2, hash);

      expect(result1).toBe(true);
      expect(result2).toBe(false);
      expect(bcrypt.compare).toHaveBeenCalledTimes(2);
    });

    it('should propagate bcrypt comparison errors', async () => {
      const plainPassword = 'testPassword123';
      const hash = '$2b$10$validHash';
      const error = new Error('Bcrypt comparison error');

      mockedBcrypt.compare.mockRejectedValue(error as never);

      await expect(hasher.compare(plainPassword, hash)).rejects.toThrow('Bcrypt comparison error');
    });

    it('should handle null and undefined inputs gracefully', async () => {
      mockedBcrypt.compare.mockResolvedValue(false as never);

      // These should not throw, but return false
      const result1 = await hasher.compare(null as any, '$2b$10$validHash');
      const result2 = await hasher.compare('password', null as any);
      const result3 = await hasher.compare(undefined as any, '$2b$10$validHash');
      const result4 = await hasher.compare('password', undefined as any);

      expect(result1).toBe(false);
      expect(result2).toBe(false);
      expect(result3).toBe(false);
      expect(result4).toBe(false);
    });
  });
});
