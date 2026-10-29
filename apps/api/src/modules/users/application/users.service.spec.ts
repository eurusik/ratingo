import { HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { AppException } from '../../../common/exceptions/app.exception';
import { DatabaseException } from '../../../common/exceptions/database.exception';

describe('UsersService', () => {
  const repo = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByUsername: jest.fn(),
    create: jest.fn(),
    updateProfile: jest.fn(),
    updatePassword: jest.fn(),
  };

  let service: UsersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UsersService(repo as any);
  });

  it('should delegate getById', async () => {
    repo.findById.mockResolvedValue({ id: 'u1' } as any);

    const result = await service.getById('u1');

    expect(repo.findById).toHaveBeenCalledWith('u1');
    expect(result).toEqual({ id: 'u1' });
  });

  it('should delegate getByEmail', async () => {
    repo.findByEmail.mockResolvedValue({ id: 'u1', email: 'user@example.com' } as any);

    const result = await service.getByEmail('user@example.com');

    expect(repo.findByEmail).toHaveBeenCalledWith('user@example.com');
    expect(result).toEqual({ id: 'u1', email: 'user@example.com' });
  });

  it('should delegate getByUsername', async () => {
    repo.findByUsername.mockResolvedValue({ id: 'u1', username: 'ratingo_fan' } as any);

    const result = await service.getByUsername('ratingo_fan');

    expect(repo.findByUsername).toHaveBeenCalledWith('ratingo_fan');
    expect(result).toEqual({ id: 'u1', username: 'ratingo_fan' });
  });

  it('should delegate updateProfile with all profile fields', async () => {
    const payload = {
      avatarUrl: 'https://cdn.example.com/avatar.png',
      username: 'ratingo_fan',
      bio: 'bio',
      location: 'Kyiv',
      website: 'https://instagram.com/profile',
      preferredLanguage: 'uk',
      preferredRegion: 'UA',
      isProfilePublic: true,
      showWatchHistory: false,
      showRatings: true,
      allowFollowers: true,
    };
    repo.updateProfile.mockResolvedValue({ id: 'u1', ...payload } as any);

    const result = await service.updateProfile('u1', payload);

    expect(repo.updateProfile).toHaveBeenCalledWith('u1', payload);
    expect(result).toMatchObject({ id: 'u1', ...payload });
  });

  it('should delegate updatePassword', async () => {
    repo.updatePassword.mockResolvedValue(undefined);

    await service.updatePassword('u1', 'hash');

    expect(repo.updatePassword).toHaveBeenCalledWith('u1', 'hash');
  });

  it('should normalize email (trim + lower-case) on getByEmail', async () => {
    repo.findByEmail.mockResolvedValue(null);

    await service.getByEmail('  User@Example.COM ');

    expect(repo.findByEmail).toHaveBeenCalledWith('user@example.com');
  });

  it('should normalize email (trim + lower-case) on createUser', async () => {
    repo.create.mockResolvedValue({ id: 'u1' } as any);

    await service.createUser({
      email: '  User@Example.COM ',
      username: 'ratingo_fan',
      passwordHash: 'hash',
    });

    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com', username: 'ratingo_fan' }),
    );
  });

  describe('updateProfile username uniqueness', () => {
    it('should throw 409 USERNAME_ALREADY_EXISTS when another user has the username (case-insensitive)', async () => {
      repo.findByUsername.mockResolvedValue({ id: 'u2', username: 'Ratingo_Fan' });

      const error = await service.updateProfile('u1', { username: 'ratingo_fan' }).catch((e) => e);

      expect(repo.findByUsername).toHaveBeenCalledWith('ratingo_fan');
      expect(error).toBeInstanceOf(AppException);
      expect(error.code).toBe(ErrorCode.USERNAME_ALREADY_EXISTS);
      expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
      expect(repo.updateProfile).not.toHaveBeenCalled();
    });

    it('should allow the user to re-case their own username', async () => {
      repo.findByUsername.mockResolvedValue({ id: 'u1', username: 'ratingo_fan' });
      repo.updateProfile.mockResolvedValue({ id: 'u1', username: 'Ratingo_Fan' });

      await service.updateProfile('u1', { username: 'Ratingo_Fan' });

      expect(repo.updateProfile).toHaveBeenCalledWith('u1', { username: 'Ratingo_Fan' });
    });

    it('should skip the lookup when username is not being changed', async () => {
      repo.updateProfile.mockResolvedValue({ id: 'u1' });

      await service.updateProfile('u1', { bio: 'hi' });

      expect(repo.findByUsername).not.toHaveBeenCalled();
    });

    it('should map a unique-violation race on update to 409', async () => {
      repo.findByUsername.mockResolvedValue(null);
      repo.updateProfile.mockRejectedValue(
        new DatabaseException('Failed to update user profile', { code: '23505' }),
      );

      const error = await service.updateProfile('u1', { username: 'taken_name' }).catch((e) => e);

      expect(error).toBeInstanceOf(AppException);
      expect(error.code).toBe(ErrorCode.USERNAME_ALREADY_EXISTS);
      expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    });

    it('should rethrow other database errors unchanged', async () => {
      repo.findByUsername.mockResolvedValue(null);
      const dbError = new DatabaseException('Failed to update user profile', { code: '08006' });
      repo.updateProfile.mockRejectedValue(dbError);

      await expect(service.updateProfile('u1', { username: 'new_name' })).rejects.toBe(dbError);
    });
  });
});
