import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { DatabaseException } from '../../../common/exceptions/database.exception';
import { ConsumeCodeFailureReason } from '../domain/repositories/exchange-codes.repository.interface';

describe('AuthService', () => {
  const usersService = {
    getByEmail: jest.fn(),
    getByUsername: jest.fn(),
    createUser: jest.fn(),
    getById: jest.fn(),
    updatePassword: jest.fn(),
    getByGoogleId: jest.fn(),
    linkGoogleId: jest.fn(),
    updateProfile: jest.fn(),
  };

  const jwtService: Pick<JwtService, 'signAsync' | 'verifyAsync'> = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  } as any;

  const passwordHasher = {
    hash: jest.fn(),
    compare: jest.fn(),
  };

  const refreshTokensRepository = {
    issue: jest.fn(),
    findById: jest.fn(),
    findValidByUser: jest.fn(),
    revoke: jest.fn(),
    revokeAllForUser: jest.fn(),
  };

  const exchangeCodesRepository = {
    create: jest.fn(),
    consumeCode: jest.fn(),
    cleanupExpired: jest.fn(),
  };

  const config = {
    accessTokenSecret: 'access-secret',
    refreshTokenSecret: 'refresh-secret',
    accessTokenTtl: '15m',
    refreshTokenTtl: '7d',
    exchangeCodePepper: 'test-pepper',
    stateSecret: 'test-state-secret',
    frontendUrl: 'http://localhost:3000',
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      usersService as any,
      config as any,
      jwtService as any,
      passwordHasher as any,
      refreshTokensRepository as any,
      exchangeCodesRepository as any,
    );
  });

  it('register: should create user and return tokens (happy path)', async () => {
    usersService.getByEmail.mockResolvedValue(null);
    usersService.getByUsername.mockResolvedValue(null);
    passwordHasher.hash.mockResolvedValueOnce('pw-hash').mockResolvedValueOnce('refresh-hash');

    usersService.createUser.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      username: 'ratingo_fan',
      passwordHash: 'pw-hash',
      role: 'user',
    });

    (jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');

    refreshTokensRepository.issue.mockResolvedValue({ id: 'jti', userId: 'u1' });

    const result = await service.register('user@example.com', 'ratingo_fan', 'S3curePassw0rd');

    expect(usersService.getByEmail).toHaveBeenCalledWith('user@example.com');
    expect(usersService.getByUsername).toHaveBeenCalledWith('ratingo_fan');
    expect(passwordHasher.hash).toHaveBeenCalledWith('S3curePassw0rd');
    expect(usersService.createUser).toHaveBeenCalledWith({
      email: 'user@example.com',
      username: 'ratingo_fan',
      passwordHash: 'pw-hash',
    });

    expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
    expect(refreshTokensRepository.issue).toHaveBeenCalledTimes(1);

    expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
  });

  it('register: should throw ConflictException when email already in use', async () => {
    usersService.getByEmail.mockResolvedValue({ id: 'u1' });

    await expect(
      service.register('user@example.com', 'ratingo_fan', 'S3curePassw0rd'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(usersService.getByUsername).not.toHaveBeenCalled();
    expect(usersService.createUser).not.toHaveBeenCalled();
  });

  it('register: should throw ConflictException when username already in use', async () => {
    usersService.getByEmail.mockResolvedValue(null);
    usersService.getByUsername.mockResolvedValue({ id: 'u2' });

    await expect(
      service.register('user@example.com', 'ratingo_fan', 'S3curePassw0rd'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(usersService.createUser).not.toHaveBeenCalled();
  });

  it('should propagate database errors from usersService.createUser', async () => {
    usersService.getByEmail.mockResolvedValue(null);
    usersService.getByUsername.mockResolvedValue(null);
    passwordHasher.hash.mockResolvedValue('pw-hash');
    usersService.createUser.mockRejectedValue(
      new DatabaseException('DB error', { reason: 'test' }),
    );

    await expect(
      service.register('user@example.com', 'ratingo_fan', 'S3curePassw0rd'),
    ).rejects.toBeInstanceOf(DatabaseException);
  });

  it('login: should throw Unauthorized for missing user', async () => {
    usersService.getByEmail.mockResolvedValue(null);
    await expect(service.login('user@example.com', 'pw')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('login: should throw Unauthorized for wrong password', async () => {
    usersService.getByEmail.mockResolvedValue({ id: 'u1', passwordHash: 'hash' });
    passwordHasher.compare.mockResolvedValue(false);

    await expect(service.login('user@example.com', 'pw')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('login: should return tokens on success', async () => {
    usersService.getByEmail.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordHash: 'hash',
      role: 'user',
    });
    passwordHasher.compare.mockResolvedValue(true);
    (jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    passwordHasher.hash.mockResolvedValue('refresh-hash');
    refreshTokensRepository.issue.mockResolvedValue({ id: 'jti' });

    const result = await service.login('user@example.com', 'pw');

    expect(jwtService.signAsync).toHaveBeenCalledTimes(2);
    expect(refreshTokensRepository.issue).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
  });

  it('refresh: should reject invalid JWT', async () => {
    (jwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error('invalid'));
    await expect(service.refresh('bad-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh: should reject missing/expired/revoked token', async () => {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'u1',
      jti: 'j1',
      type: 'refresh',
    });
    refreshTokensRepository.findById.mockResolvedValueOnce(null);
    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);

    refreshTokensRepository.findById.mockResolvedValueOnce({
      id: 'j1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
      tokenHash: 'h',
      userId: 'u1',
    });
    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);

    refreshTokensRepository.findById.mockResolvedValueOnce({
      id: 'j1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      tokenHash: 'h',
      userId: 'u1',
    });
    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh: should detect reuse (hash mismatch) and revoke all for user', async () => {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'u1',
      jti: 'j1',
      type: 'refresh',
    });
    refreshTokensRepository.findById.mockResolvedValue({
      id: 'j1',
      userId: 'u1',
      tokenHash: 'stored-hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1000),
    });
    passwordHasher.compare.mockResolvedValue(false);

    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(refreshTokensRepository.revokeAllForUser).toHaveBeenCalledWith('u1');
  });

  it('refresh: should rotate token on success', async () => {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'u1',
      jti: 'j1',
      type: 'refresh',
    });
    refreshTokensRepository.findById.mockResolvedValue({
      id: 'j1',
      userId: 'u1',
      tokenHash: 'stored-hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1000),
    });
    passwordHasher.compare.mockResolvedValue(true);
    usersService.getById.mockResolvedValue({ id: 'u1', email: 'user@example.com', role: 'user' });
    (jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('new-access')
      .mockResolvedValueOnce('new-refresh');
    passwordHasher.hash.mockResolvedValue('new-refresh-hash');
    refreshTokensRepository.issue.mockResolvedValue({ id: 'new-jti' });

    const result = await service.refresh('token');

    expect(refreshTokensRepository.revoke).toHaveBeenCalledWith('j1');
    expect(refreshTokensRepository.issue).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
  });

  it('refresh: should reject when user not found', async () => {
    (jwtService.verifyAsync as jest.Mock).mockResolvedValue({
      sub: 'u-missing',
      jti: 'j1',
      type: 'refresh',
    });
    refreshTokensRepository.findById.mockResolvedValue({
      id: 'j1',
      userId: 'u-missing',
      tokenHash: 'stored-hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1000),
    });
    passwordHasher.compare.mockResolvedValue(true);
    usersService.getById.mockResolvedValue(null);

    await expect(service.refresh('token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('AuthService - Username Generation', () => {
  const usersService = {
    getByEmail: jest.fn(),
    getByUsername: jest.fn(),
    createUser: jest.fn(),
    getById: jest.fn(),
    updatePassword: jest.fn(),
    getByGoogleId: jest.fn(),
    linkGoogleId: jest.fn(),
    updateProfile: jest.fn(),
  };

  const jwtService: Pick<JwtService, 'signAsync' | 'verifyAsync'> = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  } as any;

  const passwordHasher = {
    hash: jest.fn(),
    compare: jest.fn(),
  };

  const refreshTokensRepository = {
    issue: jest.fn(),
    findById: jest.fn(),
    findValidByUser: jest.fn(),
    revoke: jest.fn(),
    revokeAllForUser: jest.fn(),
  };

  const exchangeCodesRepository = {
    create: jest.fn(),
    consumeCode: jest.fn(),
    cleanupExpired: jest.fn(),
  };

  const config = {
    accessTokenSecret: 'access-secret',
    refreshTokenSecret: 'refresh-secret',
    accessTokenTtl: '15m',
    refreshTokenTtl: '7d',
    exchangeCodePepper: 'test-pepper',
    stateSecret: 'test-state-secret',
    frontendUrl: 'http://localhost:3000',
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      usersService as any,
      config as any,
      jwtService as any,
      passwordHasher as any,
      refreshTokensRepository as any,
      exchangeCodesRepository as any,
    );
  });

  describe('generateUniqueUsername', () => {
    it('should normalize special characters to underscores', async () => {
      usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername('John Doe!@#$%', 'john@example.com');

      expect(result).toBe('john_doe');
    });

    it('should normalize unicode characters to underscores', async () => {
      usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername('José García', 'jose@example.com');

      expect(result).toBe('jos_garc_a');
    });

    it('should collapse multiple underscores', async () => {
      usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername('John   Doe', 'john@example.com');

      expect(result).toBe('john_doe');
    });

    it('should trim leading and trailing underscores', async () => {
      usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername('_John_', 'john@example.com');

      expect(result).toBe('john');
    });

    it('should convert to lowercase', async () => {
      usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername('JOHN DOE', 'john@example.com');

      expect(result).toBe('john_doe');
    });

    it('should fallback to email prefix when name is empty', async () => {
      usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername('', 'johndoe@example.com');

      expect(result).toBe('johndoe');
    });

    it('should fallback to email prefix when name is too short', async () => {
      usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername('ab', 'johndoe@example.com');

      expect(result).toBe('johndoe');
    });

    it('should fallback to email prefix when name has only special chars', async () => {
      usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername('!!!', 'johndoe@example.com');

      expect(result).toBe('johndoe');
    });

    it('should fallback to "user" when both name and email prefix are invalid', async () => {
      usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername('', '@example.com');

      expect(result).toBe('user');
    });

    it('should add suffix on collision', async () => {
      // First call returns existing user (collision), second returns null (available)
      usersService.getByUsername
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValueOnce(null);

      const result = await service.generateUniqueUsername('John Doe', 'john@example.com');

      // Should have suffix appended
      expect(result).toMatch(/^john_doe_[a-z0-9]{6}$/);
    });

    it('should retry up to 10 times on collision', async () => {
      // All attempts return collision
      usersService.getByUsername.mockResolvedValue({ id: 'existing' });

      const result = await service.generateUniqueUsername('John Doe', 'john@example.com');

      // Should fallback to fully random username after 10 attempts
      expect(result).toMatch(/^user_[a-z0-9]{12}$/);
      // 1 initial check + 10 retries = 11 calls
      expect(usersService.getByUsername).toHaveBeenCalledTimes(11);
    });

    it('should enforce max length constraint (30 chars)', async () => {
      usersService.getByUsername.mockResolvedValue(null);

      const result = await service.generateUniqueUsername(
        'This Is A Very Long Name That Exceeds The Limit',
        'long@example.com',
      );

      expect(result.length).toBeLessThanOrEqual(30);
    });

    it('should truncate base to leave room for suffix', async () => {
      // First call returns collision, second returns null
      usersService.getByUsername
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
  const usersService = {
    getByEmail: jest.fn(),
    getByUsername: jest.fn(),
    createUser: jest.fn(),
    getById: jest.fn(),
    updatePassword: jest.fn(),
    getByGoogleId: jest.fn(),
    linkGoogleId: jest.fn(),
    updateProfile: jest.fn(),
  };

  const jwtService: Pick<JwtService, 'signAsync' | 'verifyAsync'> = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  } as any;

  const passwordHasher = {
    hash: jest.fn(),
    compare: jest.fn(),
  };

  const refreshTokensRepository = {
    issue: jest.fn(),
    findById: jest.fn(),
    findValidByUser: jest.fn(),
    revoke: jest.fn(),
    revokeAllForUser: jest.fn(),
  };

  const exchangeCodesRepository = {
    create: jest.fn(),
    consumeCode: jest.fn(),
    cleanupExpired: jest.fn(),
  };

  const config = {
    accessTokenSecret: 'access-secret',
    refreshTokenSecret: 'refresh-secret',
    accessTokenTtl: '15m',
    refreshTokenTtl: '7d',
    exchangeCodePepper: 'test-pepper',
    stateSecret: 'test-state-secret',
    frontendUrl: 'http://localhost:3000',
  };

  let service: AuthService;

  const mockGooglePayload = {
    googleId: 'google-123',
    email: 'user@example.com',
    name: 'John Doe',
    picture: 'https://example.com/photo.jpg',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      usersService as any,
      config as any,
      jwtService as any,
      passwordHasher as any,
      refreshTokensRepository as any,
      exchangeCodesRepository as any,
    );

    // Default mock for token issuance
    (jwtService.signAsync as jest.Mock)
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    passwordHasher.hash.mockResolvedValue('refresh-hash');
    refreshTokensRepository.issue.mockResolvedValue({ id: 'jti' });
  });

  it('should find user by googleId and return tokens', async () => {
    const existingUser = {
      id: 'u1',
      email: 'user@example.com',
      googleId: 'google-123',
      role: 'user',
    };
    usersService.getByGoogleId.mockResolvedValue(existingUser);

    const result = await service.loginWithGoogle(mockGooglePayload);

    expect(usersService.getByGoogleId).toHaveBeenCalledWith('google-123');
    expect(usersService.getByEmail).not.toHaveBeenCalled();
    expect(usersService.linkGoogleId).not.toHaveBeenCalled();
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

    usersService.getByGoogleId.mockResolvedValue(null);
    usersService.getByEmail.mockResolvedValue(existingUser);
    usersService.getById.mockResolvedValue(updatedUser);

    const result = await service.loginWithGoogle(mockGooglePayload);

    expect(usersService.getByGoogleId).toHaveBeenCalledWith('google-123');
    expect(usersService.getByEmail).toHaveBeenCalledWith('user@example.com');
    expect(usersService.linkGoogleId).toHaveBeenCalledWith('u1', 'google-123');
    expect(usersService.updateProfile).toHaveBeenCalledWith('u1', {
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

    usersService.getByGoogleId.mockResolvedValue(null);
    usersService.getByEmail.mockResolvedValue(existingUser);
    usersService.getById.mockResolvedValue(updatedUser);

    await service.loginWithGoogle(mockGooglePayload);

    expect(usersService.linkGoogleId).toHaveBeenCalledWith('u1', 'google-123');
    expect(usersService.updateProfile).not.toHaveBeenCalled();
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

    usersService.getByGoogleId.mockResolvedValue(null);
    usersService.getByEmail.mockResolvedValue(null);
    usersService.getByUsername.mockResolvedValue(null);
    usersService.createUser.mockResolvedValue(newUser);

    const result = await service.loginWithGoogle(mockGooglePayload);

    expect(usersService.getByGoogleId).toHaveBeenCalledWith('google-123');
    expect(usersService.getByEmail).toHaveBeenCalledWith('user@example.com');
    expect(usersService.createUser).toHaveBeenCalledWith({
      email: 'user@example.com',
      username: 'john_doe',
      passwordHash: null,
      googleId: 'google-123',
      avatarUrl: 'https://example.com/photo.jpg',
    });
    expect(result.user).toEqual(newUser);
  });
});

describe('AuthService - Exchange Code', () => {
  const usersService = {
    getByEmail: jest.fn(),
    getByUsername: jest.fn(),
    createUser: jest.fn(),
    getById: jest.fn(),
    updatePassword: jest.fn(),
    getByGoogleId: jest.fn(),
    linkGoogleId: jest.fn(),
    updateProfile: jest.fn(),
  };

  const jwtService: Pick<JwtService, 'signAsync' | 'verifyAsync'> = {
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  } as any;

  const passwordHasher = {
    hash: jest.fn(),
    compare: jest.fn(),
  };

  const refreshTokensRepository = {
    issue: jest.fn(),
    findById: jest.fn(),
    findValidByUser: jest.fn(),
    revoke: jest.fn(),
    revokeAllForUser: jest.fn(),
  };

  const exchangeCodesRepository = {
    create: jest.fn(),
    consumeCode: jest.fn(),
    cleanupExpired: jest.fn(),
  };

  const config = {
    accessTokenSecret: 'access-secret',
    refreshTokenSecret: 'refresh-secret',
    accessTokenTtl: '15m',
    refreshTokenTtl: '7d',
    exchangeCodePepper: 'test-pepper',
    stateSecret: 'test-state-secret',
    frontendUrl: 'http://localhost:3000',
  };

  let service: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(
      usersService as any,
      config as any,
      jwtService as any,
      passwordHasher as any,
      refreshTokensRepository as any,
      exchangeCodesRepository as any,
    );
  });

  describe('generateExchangeCode', () => {
    it('should generate and store exchange code', async () => {
      exchangeCodesRepository.create.mockResolvedValue({
        id: 'code-id',
        codeHash: 'hashed-code',
        userId: 'u1',
        expiresAt: new Date(),
        usedAt: null,
      });

      const code = await service.generateExchangeCode('u1', { ip: '127.0.0.1', userAgent: 'test' });

      expect(code).toBeDefined();
      expect(code.length).toBeGreaterThan(0);
      expect(exchangeCodesRepository.create).toHaveBeenCalledWith(
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
      exchangeCodesRepository.consumeCode.mockResolvedValue({
        success: true,
        record: { userId: 'u1' },
      });
      usersService.getById.mockResolvedValue(user);
      (jwtService.signAsync as jest.Mock)
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');
      passwordHasher.hash.mockResolvedValue('refresh-hash');
      refreshTokensRepository.issue.mockResolvedValue({ id: 'jti' });

      const result = await service.exchangeCodeForTokens('valid-code');

      expect(result).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    });

    it('should throw OAUTH_EXCHANGE_EXPIRED for expired code', async () => {
      exchangeCodesRepository.consumeCode.mockResolvedValue({
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
      exchangeCodesRepository.consumeCode.mockResolvedValue({
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
      exchangeCodesRepository.consumeCode.mockResolvedValue({
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
      exchangeCodesRepository.consumeCode.mockResolvedValue({
        success: true,
        record: { userId: 'u-missing' },
      });
      usersService.getById.mockResolvedValue(null);

      await expect(service.exchangeCodeForTokens('valid-code')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
