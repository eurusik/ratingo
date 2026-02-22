import { UnauthorizedException } from '@nestjs/common';

import { type User } from '../../../users/domain/entities/user.entity';
import { LocalStrategy } from './local.strategy';

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let usersService: { getByEmail: jest.Mock };
  let passwordHasher: { hash: jest.Mock; compare: jest.Mock };

  const fullUser: User = {
    id: 'u1',
    email: 'user@example.com',
    username: 'testuser',
    passwordHash: 'hashed-password',
    googleId: null,
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
    autoSubscribeOnWatch: false,
    role: 'user',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  beforeEach(() => {
    usersService = { getByEmail: jest.fn() };
    passwordHasher = { hash: jest.fn(), compare: jest.fn() };
    strategy = new LocalStrategy(usersService as any, passwordHasher as any);
  });

  it('should return full User object on valid credentials', async () => {
    usersService.getByEmail.mockResolvedValue(fullUser);
    passwordHasher.compare.mockResolvedValue(true);

    const result = await strategy.validate('user@example.com', 'correct-password');

    expect(result).toEqual(fullUser);
    expect(result.id).toBe('u1');
    expect(result.email).toBe('user@example.com');
    expect(result.role).toBe('user');
    expect(result.username).toBe('testuser');
    expect(result.passwordHash).toBe('hashed-password');
    expect(result.googleId).toBeNull();
    expect(result.avatarUrl).toBeNull();
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);

    expect(usersService.getByEmail).toHaveBeenCalledWith('user@example.com');
    expect(passwordHasher.compare).toHaveBeenCalledWith('correct-password', 'hashed-password');
  });

  it('should throw UnauthorizedException when user not found', async () => {
    usersService.getByEmail.mockResolvedValue(null);

    await expect(strategy.validate('missing@example.com', 'password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(passwordHasher.compare).not.toHaveBeenCalled();
  });

  it('should throw UnauthorizedException when user has no passwordHash', async () => {
    usersService.getByEmail.mockResolvedValue({ ...fullUser, passwordHash: null });

    await expect(strategy.validate('user@example.com', 'password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(passwordHasher.compare).not.toHaveBeenCalled();
  });

  it("should throw UnauthorizedException when password doesn't match", async () => {
    usersService.getByEmail.mockResolvedValue(fullUser);
    passwordHasher.compare.mockResolvedValue(false);

    await expect(strategy.validate('user@example.com', 'wrong-password')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(passwordHasher.compare).toHaveBeenCalledWith('wrong-password', 'hashed-password');
  });
});
