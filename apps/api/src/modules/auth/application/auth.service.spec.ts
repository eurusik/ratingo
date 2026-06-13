import { ForbiddenException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { AppException } from '../../../common/exceptions/app.exception';
import { DatabaseException } from '../../../common/exceptions/database.exception';
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

  it('register: should throw AppException with EMAIL_ALREADY_EXISTS when email taken', async () => {
    mocks.usersService.getByEmail.mockResolvedValue({ id: 'u1' });

    const error = await service
      .register('user@example.com', 'ratingo_fan', 'S3curePassw0rd')
      .catch((e) => e);

    expect(error).toBeInstanceOf(AppException);
    expect(error.code).toBe(ErrorCode.EMAIL_ALREADY_EXISTS);
    expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(mocks.usersService.getByUsername).not.toHaveBeenCalled();
    expect(mocks.usersService.createUser).not.toHaveBeenCalled();
  });

  it('register: should throw AppException with USERNAME_ALREADY_EXISTS when username taken', async () => {
    mocks.usersService.getByEmail.mockResolvedValue(null);
    mocks.usersService.getByUsername.mockResolvedValue({ id: 'u2' });

    const error = await service
      .register('user@example.com', 'ratingo_fan', 'S3curePassw0rd')
      .catch((e) => e);

    expect(error).toBeInstanceOf(AppException);
    expect(error.code).toBe(ErrorCode.USERNAME_ALREADY_EXISTS);
    expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
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

  it('should throw ForbiddenException when user not found', async () => {
    mocks.usersService.getById.mockResolvedValue(null);

    await expect(
      service.changePassword('u-missing', 'OldPass123', 'NewPass456'),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(mocks.passwordHasher.compare).not.toHaveBeenCalled();
    expect(mocks.passwordHasher.hash).not.toHaveBeenCalled();
    expect(mocks.usersService.updatePassword).not.toHaveBeenCalled();
  });

  it('should throw ForbiddenException when user has no passwordHash (OAuth-only user)', async () => {
    mocks.usersService.getById.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordHash: null,
      role: 'user',
    });

    await expect(service.changePassword('u1', 'OldPass123', 'NewPass456')).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(mocks.passwordHasher.compare).not.toHaveBeenCalled();
    expect(mocks.passwordHasher.hash).not.toHaveBeenCalled();
    expect(mocks.usersService.updatePassword).not.toHaveBeenCalled();
  });

  it('should throw ForbiddenException when current password is wrong', async () => {
    mocks.usersService.getById.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordHash: 'old-hash',
      role: 'user',
    });
    mocks.passwordHasher.compare.mockResolvedValue(false);

    await expect(service.changePassword('u1', 'WrongPass1', 'NewPass456')).rejects.toBeInstanceOf(
      ForbiddenException,
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
