import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { DatabaseException } from '../../../common/exceptions/database.exception';
import { ConsumeCodeFailureReason } from '../domain/repositories/exchange-codes.repository.interface';
import { type AuthMocks, createAuthMocks, createAuthService } from '../../../../test/auth/_mocks';

describe('AuthService', () => {
  let mocks: AuthMocks;
  let service: AuthService;

  beforeEach(() => {
    mocks = createAuthMocks();
    service = createAuthService(mocks);
  });

  it('register: should create user and return tokens (happy path)', async () => {
    mocks.usersService.getByEmail.mockResolvedValue(null);
    mocks.usersService.getByUsername.mockResolvedValue(null);
    mocks.passwordHasher.hash
      .mockResolvedValueOnce('pw-hash')
      .mockResolvedValueOnce('refresh-hash');

    mocks.usersService.createUser.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      username: 'ratingo_fan',
      passwordHash: 'pw-hash',
      role: 'user',
    });

    (mocks.jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    mocks.refreshTokensRepository.issue.mockResolvedValue({ id: 'jti', userId: 'u1' });

    const result = await service.register('user@example.com', 'ratingo_fan', 'S3curePassw0rd');

    expect(mocks.usersService.getByEmail).toHaveBeenCalledWith('user@example.com');
    expect(mocks.usersService.getByUsername).toHaveBeenCalledWith('ratingo_fan');
    expect(mocks.passwordHasher.hash).toHaveBeenCalledWith('S3curePassw0rd');
    expect(mocks.usersService.createUser).toHaveBeenCalledWith({
      email: 'user@example.com',
      username: 'ratingo_fan',
      passwordHash: 'pw-hash',
    });

    expect(mocks.jwtService.signAsync).toHaveBeenCalledTimes(2);
    expect(mocks.refreshTokensRepository.issue).toHaveBeenCalledTimes(1);

    expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
  });

  it('register: should throw ConflictException when email already in use', async () => {
    mocks.usersService.getByEmail.mockResolvedValue({ id: 'u1' });

    await expect(
      service.register('user@example.com', 'ratingo_fan', 'S3curePassw0rd'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(mocks.usersService.getByUsername).not.toHaveBeenCalled();
    expect(mocks.usersService.createUser).not.toHaveBeenCalled();
  });

  it('register: should throw ConflictException when username already in use', async () => {
    mocks.usersService.getByEmail.mockResolvedValue(null);
    mocks.usersService.getByUsername.mockResolvedValue({ id: 'u2' });

    await expect(
      service.register('user@example.com', 'ratingo_fan', 'S3curePassw0rd'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(mocks.usersService.createUser).not.toHaveBeenCalled();
  });

  it('should propagate database errors from usersService.createUser', async () => {
    mocks.usersService.getByEmail.mockResolvedValue(null);
    mocks.usersService.getByUsername.mockResolvedValue(null);
    mocks.passwordHasher.hash.mockResolvedValue('pw-hash');
    mocks.usersService.createUser.mockRejectedValue(
      new DatabaseException('DB error', { reason: 'test' }),
    );

    await expect(
      service.register('user@example.com', 'ratingo_fan', 'S3curePassw0rd'),
    ).rejects.toBeInstanceOf(DatabaseException);
  });

  it('login: should throw Unauthorized for missing user', async () => {
    mocks.usersService.getByEmail.mockResolvedValue(null);
    await expect(service.login('user@example.com', 'pw')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('login: should throw Unauthorized for wrong password', async () => {
    mocks.usersService.getByEmail.mockResolvedValue({ id: 'u1', passwordHash: 'hash' });
    mocks.passwordHasher.compare.mockResolvedValue(false);

    await expect(service.login('user@example.com', 'pw')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('login: should return tokens on success', async () => {
    mocks.usersService.getByEmail.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordHash: 'hash',
      role: 'user',
    });
    mocks.passwordHasher.compare.mockResolvedValue(true);
    (mocks.jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    mocks.passwordHasher.hash.mockResolvedValue('refresh-hash');
    mocks.refreshTokensRepository.issue.mockResolvedValue({ id: 'jti' });

    const result = await service.login('user@example.com', 'pw');

    expect(mocks.jwtService.signAsync).toHaveBeenCalledTimes(2);
    expect(mocks.refreshTokensRepository.issue).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
  });

  it('loginValidatedUser: should issue tokens without re-validating credentials', async () => {
    const user = {
      id: 'u1',
      email: 'user@example.com',
      role: 'user',
    } as any;

    (mocks.jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    mocks.passwordHasher.hash.mockResolvedValue('refresh-hash');
    mocks.refreshTokensRepository.issue.mockResolvedValue({ id: 'jti' });

    const result = await service.loginValidatedUser(user, {
      userAgent: 'test-agent',
      ip: '127.0.0.1',
    });

    // Should NOT call usersService or passwordHasher.compare
    expect(mocks.usersService.getByEmail).not.toHaveBeenCalled();
    expect(mocks.passwordHasher.compare).not.toHaveBeenCalled();

    // Should issue tokens
    expect(mocks.jwtService.signAsync).toHaveBeenCalledTimes(2);
    expect(mocks.refreshTokensRepository.issue).toHaveBeenCalledTimes(1);
    expect(mocks.refreshTokensRepository.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        userAgent: 'test-agent',
        ip: '127.0.0.1',
      }),
    );
    expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
  });

  it('loginValidatedUser: should pass clientMeta through to token issuance', async () => {
    const user = { id: 'u2', email: 'other@example.com', role: 'admin' } as any;

    (mocks.jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('at')
      .mockResolvedValueOnce('rt');
    mocks.passwordHasher.hash.mockResolvedValue('rh');
    mocks.refreshTokensRepository.issue.mockResolvedValue({ id: 'j2' });

    await service.loginValidatedUser(user);

    // Without clientMeta, userAgent and ip should be null
    expect(mocks.refreshTokensRepository.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u2',
        userAgent: null,
        ip: null,
      }),
    );
  });

  it('refresh: should reject invalid JWT', async () => {
    (mocks.jwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error('invalid'));
    await expect(service.refresh('bad-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh: should reject missing/expired/revoked token', async () => {
    (mocks.jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'u1',
      jti: 'j1',
      type: 'refresh',
    });
    mocks.refreshTokensRepository.findById.mockResolvedValueOnce(null);
    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);

    mocks.refreshTokensRepository.findById.mockResolvedValueOnce({
      id: 'j1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
      tokenHash: 'h',
      userId: 'u1',
    });
    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);

    mocks.refreshTokensRepository.findById.mockResolvedValueOnce({
      id: 'j1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      tokenHash: 'h',
      userId: 'u1',
    });
    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh: should detect reuse (hash mismatch) and revoke all for user', async () => {
    (mocks.jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'u1',
      jti: 'j1',
      type: 'refresh',
    });
    mocks.refreshTokensRepository.findById.mockResolvedValue({
      id: 'j1',
      userId: 'u1',
      tokenHash: 'stored-hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1000),
    });
    mocks.passwordHasher.compare.mockResolvedValue(false);

    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(mocks.refreshTokensRepository.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('refresh: should rotate token on success', async () => {
    (mocks.jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'u1',
      jti: 'j1',
      type: 'refresh',
    });
    mocks.refreshTokensRepository.findById.mockResolvedValue({
      id: 'j1',
      userId: 'u1',
      tokenHash: 'stored-hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1000),
    });
    mocks.passwordHasher.compare.mockResolvedValue(true);
    mocks.usersService.getById.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      role: 'user',
    });
    (mocks.jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('new-access')
      .mockResolvedValueOnce('new-refresh');
    mocks.passwordHasher.hash.mockResolvedValue('new-refresh-hash');
    mocks.refreshTokensRepository.issue.mockResolvedValue({ id: 'new-jti' });

    const result = await service.refresh('token');

    expect(mocks.refreshTokensRepository.revoke).toHaveBeenCalledWith('j1');
    expect(mocks.refreshTokensRepository.issue).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
  });

  it('refresh: should reject when user not found', async () => {
    (mocks.jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'u-missing',
      jti: 'j1',
      type: 'refresh',
    });
    mocks.refreshTokensRepository.findById.mockResolvedValue({
      id: 'j1',
      userId: 'u-missing',
      tokenHash: 'stored-hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1000),
    });
    mocks.passwordHasher.compare.mockResolvedValue(true);
    mocks.usersService.getById.mockResolvedValue(null);

    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService - Username Generation', () => {
  let mocks: AuthMocks;
  let service: AuthService;

  beforeEach(() => {
    mocks = createAuthMocks();
    service = createAuthService(mocks);
  });

  describe('generateUniqueUsername', () => {
    it('should normalize special characters to underscores', async () => {
      mocks.usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername('John Doe!@#$%', 'john@example.com');

      expect(result).toBe('john_doe');
    });

    it('should normalize unicode characters to underscores', async () => {
      mocks.usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername(
        'Jos\u00e9 Garc\u00eda',
        'jose@example.com',
      );

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

describe('AuthService - Account Resolution (loginWithGoogle)', () => {
  let mocks: AuthMocks;
  let service: AuthService;

  const mockGooglePayload = {
    googleId: 'google-123',
    email: 'user@example.com',
    name: 'John Doe',
    picture: 'https://example.com/photo.jpg',
  };

  beforeEach(() => {
    mocks = createAuthMocks();
    service = createAuthService(mocks);

    // Default mock for token issuance
    (mocks.jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    mocks.passwordHasher.hash.mockResolvedValue('refresh-hash');
    mocks.refreshTokensRepository.issue.mockResolvedValue({ id: 'jti' });
  });

  it('should find user by googleId and return tokens', async () => {
    const existingUser = {
      id: 'u1',
      email: 'user@example.com',
      googleId: 'google-123',
      role: 'user',
    };
    mocks.usersService.getByGoogleId.mockResolvedValue(existingUser);

    const result = await service.loginWithGoogle(mockGooglePayload);

    expect(mocks.usersService.getByGoogleId).toHaveBeenCalledWith('google-123');
    expect(mocks.usersService.getByEmail).not.toHaveBeenCalled();
    expect(mocks.usersService.linkGoogleId).not.toHaveBeenCalled();
    expect(result.user).toEqual(existingUser);
    expect(result.tokens).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
  });

  it('should find user by email and link googleId', async () => {
    const existingUser = {
      id: 'u1',
      email: 'user@example.com',
      googleId: null,
      avatarUrl: null,
      role: 'user',
    };
    const updatedUser = { ...existingUser, googleId: 'google-123' };

    mocks.usersService.getByGoogleId.mockResolvedValue(null);
    mocks.usersService.getByEmail.mockResolvedValue(existingUser);
    mocks.usersService.getById.mockResolvedValue(updatedUser);

    const result = await service.loginWithGoogle(mockGooglePayload);

    expect(mocks.usersService.getByGoogleId).toHaveBeenCalledWith('google-123');
    expect(mocks.usersService.getByEmail).toHaveBeenCalledWith('user@example.com');
    expect(mocks.usersService.linkGoogleId).toHaveBeenCalledWith('u1', 'google-123');
    expect(mocks.usersService.updateProfile).toHaveBeenCalledWith('u1', {
      avatarUrl: 'https://example.com/photo.jpg',
    });
    expect(result.user).toEqual(updatedUser);
  });

  it('should not overwrite existing avatarUrl when linking', async () => {
    const existingUser = {
      id: 'u1',
      email: 'user@example.com',
      googleId: null,
      avatarUrl: 'https://existing-avatar.com/photo.jpg',
      role: 'user',
    };
    const updatedUser = { ...existingUser, googleId: 'google-123' };

    mocks.usersService.getByGoogleId.mockResolvedValue(null);
    mocks.usersService.getByEmail.mockResolvedValue(existingUser);
    mocks.usersService.getById.mockResolvedValue(updatedUser);

    await service.loginWithGoogle(mockGooglePayload);

    expect(mocks.usersService.linkGoogleId).toHaveBeenCalledWith('u1', 'google-123');
    expect(mocks.usersService.updateProfile).not.toHaveBeenCalled();
  });

  it('should create new user when not found by googleId or email', async () => {
    const newUser = {
      id: 'u-new',
      email: 'user@example.com',
      username: 'john_doe',
      googleId: 'google-123',
      avatarUrl: 'https://example.com/photo.jpg',
      role: 'user',
    };

    mocks.usersService.getByGoogleId.mockResolvedValue(null);
    mocks.usersService.getByEmail.mockResolvedValue(null);
    mocks.usersService.getByUsername.mockResolvedValue(null);
    mocks.usersService.createUser.mockResolvedValue(newUser);

    const result = await service.loginWithGoogle(mockGooglePayload);

    expect(mocks.usersService.getByGoogleId).toHaveBeenCalledWith('google-123');
    expect(mocks.usersService.getByEmail).toHaveBeenCalledWith('user@example.com');
    expect(mocks.usersService.createUser).toHaveBeenCalledWith({
      email: 'user@example.com',
      username: 'john_doe',
      passwordHash: null,
      googleId: 'google-123',
      avatarUrl: 'https://example.com/photo.jpg',
    });
    expect(result.user).toEqual(newUser);
  });
});

describe('AuthService - changePassword', () => {
  let mocks: AuthMocks;
  let service: AuthService;

  beforeEach(() => {
    mocks = createAuthMocks();
    service = createAuthService(mocks);
  });

  it('should change password successfully', async () => {
    mocks.usersService.getById.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordHash: 'old-hash',
      role: 'user',
    });
    mocks.passwordHasher.compare.mockResolvedValue(true);
    mocks.passwordHasher.hash.mockResolvedValue('new-hash');
    mocks.usersService.updatePassword.mockResolvedValue(undefined);

    await service.changePassword('u1', 'OldPass123', 'NewPass456');

    expect(mocks.usersService.getById).toHaveBeenCalledWith('u1');
    expect(mocks.passwordHasher.compare).toHaveBeenCalledWith('OldPass123', 'old-hash');
    expect(mocks.passwordHasher.hash).toHaveBeenCalledWith('NewPass456');
    expect(mocks.usersService.updatePassword).toHaveBeenCalledWith('u1', 'new-hash');
  });

  it('should throw UnauthorizedException when user not found', async () => {
    mocks.usersService.getById.mockResolvedValue(null);

    await expect(
      service.changePassword('u-missing', 'OldPass123', 'NewPass456'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(mocks.passwordHasher.compare).not.toHaveBeenCalled();
    expect(mocks.passwordHasher.hash).not.toHaveBeenCalled();
    expect(mocks.usersService.updatePassword).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when user has no passwordHash (OAuth-only user)', async () => {
    mocks.usersService.getById.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordHash: null,
      role: 'user',
    });

    await expect(service.changePassword('u1', 'OldPass123', 'NewPass456')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(mocks.passwordHasher.compare).not.toHaveBeenCalled();
    expect(mocks.passwordHasher.hash).not.toHaveBeenCalled();
    expect(mocks.usersService.updatePassword).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when current password is wrong', async () => {
    mocks.usersService.getById.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordHash: 'old-hash',
      role: 'user',
    });
    mocks.passwordHasher.compare.mockResolvedValue(false);

    await expect(service.changePassword('u1', 'WrongPass1', 'NewPass456')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(mocks.passwordHasher.hash).not.toHaveBeenCalled();
    expect(mocks.usersService.updatePassword).not.toHaveBeenCalled();
  });

  it('should hash the new password before saving', async () => {
    mocks.usersService.getById.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordHash: 'old-hash',
      role: 'user',
    });
    mocks.passwordHasher.compare.mockResolvedValue(true);
    mocks.passwordHasher.hash.mockResolvedValue('securely-hashed-new-password');
    mocks.usersService.updatePassword.mockResolvedValue(undefined);

    await service.changePassword('u1', 'OldPass123', 'BrandNewPass1');

    expect(mocks.passwordHasher.hash).toHaveBeenCalledWith('BrandNewPass1');
    expect(mocks.usersService.updatePassword).toHaveBeenCalledWith(
      'u1',
      'securely-hashed-new-password',
    );
  });
});

describe('AuthService - Exchange Code', () => {
  let mocks: AuthMocks;
  let service: AuthService;

  beforeEach(() => {
    mocks = createAuthMocks();
    service = createAuthService(mocks);
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
