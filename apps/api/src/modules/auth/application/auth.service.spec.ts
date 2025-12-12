import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { DatabaseException } from '../../../common/exceptions/database.exception';

describe('AuthService', () => {
  const usersService = {
    getByEmail: jest.fn(),
    getByUsername: jest.fn(),
    createUser: jest.fn(),
    getById: jest.fn(),
    updatePassword: jest.fn(),
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

  const config = {
    accessTokenSecret: 'access-secret',
    refreshTokenSecret: 'refresh-secret',
    accessTokenTtl: '15m',
    refreshTokenTtl: '7d',
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
