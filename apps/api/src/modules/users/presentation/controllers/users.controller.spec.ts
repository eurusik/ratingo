import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from '../../application/users.service';
import { AuthService } from '../../../auth/application/auth.service';

describe('UsersController', () => {
  let controller: UsersController;
  const usersService = {
    getById: jest.fn(),
    updateProfile: jest.fn(),
  };
  const authService = {
    changePassword: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: AuthService, useValue: authService },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('should return current user without passwordHash', async () => {
    usersService.getById.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      passwordHash: 'hashed',
      username: 'ratingo_fan',
    });

    const result = await controller.me({ id: 'u1' });

    expect(usersService.getById).toHaveBeenCalledWith('u1');
    expect(result).toEqual({
      id: 'u1',
      email: 'user@example.com',
      username: 'ratingo_fan',
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('me should return null when user not found', async () => {
    usersService.getById.mockResolvedValue(null);

    const result = await controller.me({ id: 'u-missing' });

    expect(usersService.getById).toHaveBeenCalledWith('u-missing');
    expect(result).toBeNull();
  });

  it('should forward all profile fields to service and strip passwordHash', async () => {
    usersService.updateProfile.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      username: 'ratingo_fan',
      avatarUrl: 'https://cdn.example.com/avatar.png',
      bio: 'bio',
      location: 'Kyiv',
      website: 'https://instagram.com/profile',
      preferredLanguage: 'uk',
      preferredRegion: 'UA',
      isProfilePublic: true,
      showWatchHistory: false,
      showRatings: true,
      allowFollowers: true,
      passwordHash: 'hashed',
      role: 'user',
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
    });

    const dto = {
      username: 'ratingo_fan',
      avatarUrl: 'https://cdn.example.com/avatar.png',
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

    const result = await controller.updateProfile({ id: 'u1' }, dto as any);

    expect(usersService.updateProfile).toHaveBeenCalledWith('u1', dto);
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).toMatchObject({
      id: 'u1',
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
    });
  });

  it('should allow partial profile update payload', async () => {
    usersService.updateProfile.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      username: 'new_name',
      avatarUrl: null,
      bio: null,
      location: null,
      website: null,
      preferredLanguage: null,
      preferredRegion: null,
      isProfilePublic: true,
      showWatchHistory: true,
      showRatings: true,
      allowFollowers: true,
      passwordHash: 'hashed',
      role: 'user',
      createdAt: new Date('2025-01-01'),
      updatedAt: new Date('2025-01-02'),
    });

    const dto = {
      username: 'new_name',
    };

    await controller.updateProfile({ id: 'u1' }, dto as any);
    expect(usersService.updateProfile).toHaveBeenCalledWith('u1', {
      username: 'new_name',
      avatarUrl: undefined,
      bio: undefined,
      location: undefined,
      website: undefined,
      preferredLanguage: undefined,
      preferredRegion: undefined,
      isProfilePublic: undefined,
      showWatchHistory: undefined,
      showRatings: undefined,
      allowFollowers: undefined,
    });
  });

  it('should delegate changePassword to authService', async () => {
    authService.changePassword.mockResolvedValue(undefined);

    await controller.changePassword({ id: 'u1' }, {
      currentPassword: 'old',
      newPassword: 'new',
    } as any);

    expect(authService.changePassword).toHaveBeenCalledWith('u1', 'old', 'new');
  });
});
