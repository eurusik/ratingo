import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { DatabaseException } from '../../../common/exceptions/database.exception';

describe('AuthService.register', () => {
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

  it('should register user and return tokens (happy path)', async () => {
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

  it('should throw ConflictException when email already in use', async () => {
    usersService.getByEmail.mockResolvedValue({ id: 'u1' });

    await expect(
      service.register('user@example.com', 'ratingo_fan', 'S3curePassw0rd'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(usersService.getByUsername).not.toHaveBeenCalled();
    expect(usersService.createUser).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when username already in use', async () => {
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
});
