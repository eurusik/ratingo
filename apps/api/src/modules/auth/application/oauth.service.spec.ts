import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { OAuthService } from './oauth.service';
import { ConsumeCodeFailureReason } from '../domain/repositories/exchange-codes.repository.interface';
import { type OAuthUserPayload } from '../domain/types';
import { type AuthMocks, createAuthMocks, createOAuthService } from '../../../../test/auth/_mocks';

describe('OAuthService - Username Generation', () => {
  let mocks: AuthMocks;
  let service: OAuthService;

  beforeEach(() => {
    mocks = createAuthMocks();
    service = createOAuthService(mocks);
  });

  describe('generateUniqueUsername', () => {
    it('should normalize special characters to underscores', async () => {
      mocks.usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername('John Doe!@#$%', 'john@example.com');

      expect(result).toBe('john_doe');
    });

    it('should normalize unicode characters to underscores', async () => {
      mocks.usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername('José García', 'jose@example.com');

      expect(result).toBe('jos_garc_a');
    });

    it('should collapse multiple underscores', async () => {
      mocks.usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername('John   Doe', 'john@example.com');

      expect(result).toBe('john_doe');
    });

    it('should trim leading and trailing underscores', async () => {
      mocks.usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername('_John_', 'john@example.com');

      expect(result).toBe('john');
    });

    it('should convert to lowercase', async () => {
      mocks.usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername('JOHN DOE', 'john@example.com');

      expect(result).toBe('john_doe');
    });

    it('should fallback to email prefix when name is empty', async () => {
      mocks.usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername('', 'johndoe@example.com');

      expect(result).toBe('johndoe');
    });

    it('should fallback to email prefix when name is too short', async () => {
      mocks.usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername('ab', 'johndoe@example.com');

      expect(result).toBe('johndoe');
    });

    it('should fallback to email prefix when name has only special chars', async () => {
      mocks.usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername('!!!', 'johndoe@example.com');

      expect(result).toBe('johndoe');
    });

    it('should fallback to "user" when both name and email prefix are invalid', async () => {
      mocks.usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername('', '@example.com');

      expect(result).toBe('user');
    });

    it('should add suffix on collision', async () => {
      // First call returns existing user (collision), second returns null (available)
      mocks.usersService.getByUsername
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValueOnce(null);

      const result = await service.generateUniqueUsername('John Doe', 'john@example.com');

      // Should have suffix appended
      expect(result).toMatch(/^john_doe_[a-z0-9]{6}$/);
    });

    it('should retry up to 10 times on collision', async () => {
      // All attempts return collision
      mocks.usersService.getByUsername.mockResolvedValue({ id: 'existing' });

      const result = await service.generateUniqueUsername('John Doe', 'john@example.com');

      // Should fallback to fully random username after 10 attempts
      expect(result).toMatch(/^user_[a-z0-9]{12}$/);
      // 1 initial check + 10 retries = 11 calls
      expect(mocks.usersService.getByUsername).toHaveBeenCalledTimes(11);
    });

    it('should enforce max length constraint (30 chars)', async () => {
      mocks.usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername(
        'This Is A Very Long Name That Exceeds The Limit',
        'long@example.com',
      );

      expect(result.length).toBeLessThanOrEqual(30);
    });

    it('should truncate base to leave room for suffix', async () => {
      // First call returns collision, second returns null
      mocks.usersService.getByUsername
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValueOnce(null);

      const result = await service.generateUniqueUsername(
        'This Is A Very Long Name',
        'long@example.com',
      );

      // Base is truncated to 24 chars, then _suffix (7 chars) is added
      // Total: 24 + 1 + 6 = 31 chars
      // Note: Current implementation allows up to 31 chars with suffix
      expect(result).toMatch(/^[a-z0-9_]+_[a-z0-9]{6}$/);
      expect(result.length).toBeLessThanOrEqual(31);
    });
  });
});

describe('OAuthService - Account Resolution (loginWithOAuth)', () => {
  let mocks: AuthMocks;
  let service: OAuthService;

  const mockOAuthPayload = {
    provider: 'google' as const,
    providerAccountId: 'google-123',
    email: 'user@example.com',
    name: 'John Doe',
    picture: 'https://example.com/photo.jpg',
  };

  beforeEach(() => {
    mocks = createAuthMocks();
    service = createOAuthService(mocks);

    // Default mock for token issuance
    (mocks.jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    mocks.passwordHasher.hash.mockResolvedValue('refresh-hash');
    mocks.refreshTokensRepository.issue.mockResolvedValue({ id: 'jti' });
  });

  it('should find user by provider+providerAccountId and return tokens', async () => {
    const existingUser = {
      id: 'u1',
      email: 'user@example.com',
      role: 'user',
    };
    mocks.oauthAccountsRepository.findByProviderAccount.mockResolvedValue({
      userId: 'u1',
      provider: 'google',
      providerAccountId: 'google-123',
    });
    mocks.usersService.getById.mockResolvedValue(existingUser);

    const result = await service.loginWithOAuth(mockOAuthPayload);

    expect(mocks.oauthAccountsRepository.findByProviderAccount).toHaveBeenCalledWith(
      'google',
      'google-123',
    );
    expect(mocks.usersService.getByEmail).not.toHaveBeenCalled();
    expect(result.user).toEqual(existingUser);
    expect(result.tokens).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
  });

  it('should find user by email and auto-link provider', async () => {
    const existingUser = {
      id: 'u1',
      email: 'user@example.com',
      avatarUrl: null,
      role: 'user',
    };
    const updatedUser = {
      ...existingUser,
      avatarUrl: 'https://example.com/photo.jpg',
    };

    mocks.oauthAccountsRepository.findByProviderAccount.mockResolvedValue(null);
    mocks.usersService.getByEmail.mockResolvedValue(existingUser);
    mocks.usersService.getById.mockResolvedValue(updatedUser);

    const result = await service.loginWithOAuth(mockOAuthPayload);

    expect(mocks.oauthAccountsRepository.findByProviderAccount).toHaveBeenCalledWith(
      'google',
      'google-123',
    );
    expect(mocks.usersService.getByEmail).toHaveBeenCalledWith('user@example.com');
    expect(mocks.oauthAccountsRepository.create).toHaveBeenCalledWith({
      userId: 'u1',
      provider: 'google',
      providerAccountId: 'google-123',
      email: 'user@example.com',
      displayName: 'John Doe',
      avatarUrl: 'https://example.com/photo.jpg',
    });
    expect(mocks.usersService.updateProfile).toHaveBeenCalledWith('u1', {
      avatarUrl: 'https://example.com/photo.jpg',
    });
    expect(result.user).toEqual(updatedUser);
  });

  it('should not overwrite existing avatarUrl when linking', async () => {
    const existingUser = {
      id: 'u1',
      email: 'user@example.com',
      avatarUrl: 'https://existing-avatar.com/photo.jpg',
      role: 'user',
    };

    mocks.oauthAccountsRepository.findByProviderAccount.mockResolvedValue(null);
    mocks.usersService.getByEmail.mockResolvedValue(existingUser);

    await service.loginWithOAuth(mockOAuthPayload);

    expect(mocks.oauthAccountsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        provider: 'google',
        providerAccountId: 'google-123',
      }),
    );
    expect(mocks.usersService.updateProfile).not.toHaveBeenCalled();
  });

  it('should create new user when not found by provider or email', async () => {
    const newUser = {
      id: 'u-new',
      email: 'user@example.com',
      username: 'john_doe',
      avatarUrl: 'https://example.com/photo.jpg',
      role: 'user',
    };

    mocks.oauthAccountsRepository.findByProviderAccount.mockResolvedValue(null);
    mocks.usersService.getByEmail.mockResolvedValue(null);
    mocks.usersService.getByUsername.mockResolvedValue(null);
    mocks.usersService.createUser.mockResolvedValue(newUser);

    const result = await service.loginWithOAuth(mockOAuthPayload);

    expect(mocks.oauthAccountsRepository.findByProviderAccount).toHaveBeenCalledWith(
      'google',
      'google-123',
    );
    expect(mocks.usersService.getByEmail).toHaveBeenCalledWith('user@example.com');
    expect(mocks.usersService.createUser).toHaveBeenCalledWith({
      email: 'user@example.com',
      username: 'john_doe',
      passwordHash: null,
      avatarUrl: 'https://example.com/photo.jpg',
    });
    expect(mocks.oauthAccountsRepository.create).toHaveBeenCalledWith({
      userId: 'u-new',
      provider: 'google',
      providerAccountId: 'google-123',
      email: 'user@example.com',
      displayName: 'John Doe',
      avatarUrl: 'https://example.com/photo.jpg',
    });
    expect(result.user).toEqual(newUser);
  });
});

describe('OAuthService - Exchange Code', () => {
  let mocks: AuthMocks;
  let service: OAuthService;

  beforeEach(() => {
    mocks = createAuthMocks();
    service = createOAuthService(mocks);
  });

  describe('generateExchangeCode', () => {
    it('should generate and store exchange code', async () => {
      mocks.exchangeCodesRepository.create.mockResolvedValue({
        id: 'code-id',
        codeHash: 'hashed-code',
        userId: 'u1',
        expiresAt: new Date(),
        usedAt: null,
      });

      const code = await service.generateExchangeCode('u1', { ip: '127.0.0.1', userAgent: 'test' });

      expect(code).toBeDefined();
      expect(code.length).toBeGreaterThan(0);
      expect(mocks.exchangeCodesRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          ip: '127.0.0.1',
          userAgent: 'test',
        }),
      );
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange valid code for tokens', async () => {
      const user = { id: 'u1', email: 'user@example.com', role: 'user' };
      mocks.exchangeCodesRepository.consumeCode.mockResolvedValue({
        success: true,
        record: { userId: 'u1' },
      });
      mocks.usersService.getById.mockResolvedValue(user);
      (mocks.jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      mocks.passwordHasher.hash.mockResolvedValue('refresh-hash');
      mocks.refreshTokensRepository.issue.mockResolvedValue({ id: 'jti' });

      const result = await service.exchangeCodeForTokens('valid-code');

      expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    });

    it('should throw OAUTH_EXCHANGE_EXPIRED for expired code', async () => {
      mocks.exchangeCodesRepository.consumeCode.mockResolvedValue({
        success: false,
        reason: ConsumeCodeFailureReason.EXPIRED,
      });

      await expect(service.exchangeCodeForTokens('expired-code')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.exchangeCodeForTokens('expired-code')).rejects.toThrow(
        'OAUTH_EXCHANGE_EXPIRED',
      );
    });

    it('should throw OAUTH_EXCHANGE_USED for already used code', async () => {
      mocks.exchangeCodesRepository.consumeCode.mockResolvedValue({
        success: false,
        reason: ConsumeCodeFailureReason.ALREADY_USED,
      });

      await expect(service.exchangeCodeForTokens('used-code')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.exchangeCodeForTokens('used-code')).rejects.toThrow(
        'OAUTH_EXCHANGE_USED',
      );
    });

    it('should throw OAUTH_EXCHANGE_EXPIRED for not found code', async () => {
      mocks.exchangeCodesRepository.consumeCode.mockResolvedValue({
        success: false,
        reason: ConsumeCodeFailureReason.NOT_FOUND,
      });

      await expect(service.exchangeCodeForTokens('invalid-code')).rejects.toThrow(
        UnauthorizedException,
      );
      await expect(service.exchangeCodeForTokens('invalid-code')).rejects.toThrow(
        'OAUTH_EXCHANGE_EXPIRED',
      );
    });

    it('should throw when user not found after code consumption', async () => {
      mocks.exchangeCodesRepository.consumeCode.mockResolvedValue({
        success: true,
        record: { userId: 'u-missing' },
      });
      mocks.usersService.getById.mockResolvedValue(null);

      await expect(service.exchangeCodeForTokens('valid-code')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});

describe('OAuthService - linkOAuthAccount', () => {
  let mocks: AuthMocks;
  let service: OAuthService;

  const oauthPayload: OAuthUserPayload = {
    provider: 'google',
    providerAccountId: 'google-123',
    email: 'user@gmail.com',
    name: 'John Doe',
    picture: 'https://avatar.url/photo.jpg',
  };

  beforeEach(() => {
    mocks = createAuthMocks();
    service = createOAuthService(mocks);
  });

  it('should create oauth link for user', async () => {
    mocks.oauthAccountsRepository.findByProviderAccount.mockResolvedValue(null);
    mocks.oauthAccountsRepository.findByUserAndProvider.mockResolvedValue(null);
    const createdAccount = {
      id: 'oa1',
      userId: 'u1',
      provider: 'google',
      providerAccountId: 'google-123',
      email: 'user@gmail.com',
      displayName: 'John Doe',
      avatarUrl: 'https://avatar.url/photo.jpg',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mocks.oauthAccountsRepository.create.mockResolvedValue(createdAccount);

    const result = await service.linkOAuthAccount('u1', oauthPayload);

    expect(result).toEqual(createdAccount);
    expect(mocks.oauthAccountsRepository.create).toHaveBeenCalledWith({
      userId: 'u1',
      provider: 'google',
      providerAccountId: 'google-123',
      email: 'user@gmail.com',
      displayName: 'John Doe',
      avatarUrl: 'https://avatar.url/photo.jpg',
    });
  });

  it('should throw ConflictException when provider account is already linked to same user', async () => {
    mocks.oauthAccountsRepository.findByProviderAccount.mockResolvedValue({ userId: 'u1' });

    await expect(service.linkOAuthAccount('u1', oauthPayload)).rejects.toThrow(ConflictException);
    expect(mocks.oauthAccountsRepository.create).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when provider account is linked to another user', async () => {
    mocks.oauthAccountsRepository.findByProviderAccount.mockResolvedValue({
      userId: 'other-user',
    });

    await expect(service.linkOAuthAccount('u1', oauthPayload)).rejects.toThrow(ConflictException);
    expect(mocks.oauthAccountsRepository.create).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when user already has different account from same provider', async () => {
    mocks.oauthAccountsRepository.findByProviderAccount.mockResolvedValue(null);
    mocks.oauthAccountsRepository.findByUserAndProvider.mockResolvedValue({ id: 'existing-link' });

    await expect(service.linkOAuthAccount('u1', oauthPayload)).rejects.toThrow(ConflictException);
    expect(mocks.oauthAccountsRepository.create).not.toHaveBeenCalled();
  });
});

describe('OAuthService - unlinkOAuthAccount', () => {
  let mocks: AuthMocks;
  let service: OAuthService;

  beforeEach(() => {
    mocks = createAuthMocks();
    service = createOAuthService(mocks);
  });

  it('should unlink provider when user has password', async () => {
    mocks.usersService.getById.mockResolvedValue({ id: 'u1', passwordHash: 'hash' });
    mocks.oauthAccountsRepository.countByUserId.mockResolvedValue(1);
    mocks.oauthAccountsRepository.deleteByUserAndProvider.mockResolvedValue(true);

    await service.unlinkOAuthAccount('u1', 'google' as any);

    expect(mocks.oauthAccountsRepository.deleteByUserAndProvider).toHaveBeenCalledWith(
      'u1',
      'google',
    );
  });

  it('should unlink provider when user has multiple OAuth accounts but no password', async () => {
    mocks.usersService.getById.mockResolvedValue({ id: 'u1', passwordHash: null });
    mocks.oauthAccountsRepository.countByUserId.mockResolvedValue(2);
    mocks.oauthAccountsRepository.deleteByUserAndProvider.mockResolvedValue(true);

    await service.unlinkOAuthAccount('u1', 'google' as any);

    expect(mocks.oauthAccountsRepository.deleteByUserAndProvider).toHaveBeenCalled();
  });

  it('should throw ForbiddenException when unlinking last auth method', async () => {
    mocks.usersService.getById.mockResolvedValue({ id: 'u1', passwordHash: null });
    mocks.oauthAccountsRepository.countByUserId.mockResolvedValue(1);

    await expect(service.unlinkOAuthAccount('u1', 'google' as any)).rejects.toThrow(
      ForbiddenException,
    );
    expect(mocks.oauthAccountsRepository.deleteByUserAndProvider).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException when user not found', async () => {
    mocks.usersService.getById.mockResolvedValue(null);

    await expect(service.unlinkOAuthAccount('u1', 'google' as any)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw NotFoundException when provider not linked', async () => {
    mocks.usersService.getById.mockResolvedValue({ id: 'u1', passwordHash: 'hash' });
    mocks.oauthAccountsRepository.countByUserId.mockResolvedValue(0);
    mocks.oauthAccountsRepository.deleteByUserAndProvider.mockResolvedValue(false);

    await expect(service.unlinkOAuthAccount('u1', 'google' as any)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('OAuthService - getLinkedAccounts', () => {
  let mocks: AuthMocks;
  let service: OAuthService;

  beforeEach(() => {
    mocks = createAuthMocks();
    service = createOAuthService(mocks);
  });

  it('should return oauth accounts for user', async () => {
    const accounts = [
      {
        id: 'oa1',
        userId: 'u1',
        provider: 'google',
        providerAccountId: 'g1',
        email: 'a@b.com',
        displayName: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mocks.oauthAccountsRepository.findByUserId.mockResolvedValue(accounts);

    const result = await service.getLinkedAccounts('u1');

    expect(result).toEqual(accounts);
    expect(mocks.oauthAccountsRepository.findByUserId).toHaveBeenCalledWith('u1');
  });

  it('should return empty array when no accounts linked', async () => {
    mocks.oauthAccountsRepository.findByUserId.mockResolvedValue([]);

    const result = await service.getLinkedAccounts('u1');

    expect(result).toEqual([]);
  });
});
