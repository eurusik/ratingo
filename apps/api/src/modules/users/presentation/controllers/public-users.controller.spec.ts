import { Test, TestingModule } from '@nestjs/testing';
import { PublicUsersController } from './public-users.controller';
import { UsersService } from '../../application/users.service';
import { NotFoundException } from '@nestjs/common';
import { PublicUserMediaService } from '../../application/public-user-media.service';

describe('PublicUsersController', () => {
  let controller: PublicUsersController;
  const usersService = {
    getPublicProfileByUsername: jest.fn(),
  };
  const publicUserMediaService = {
    getRatings: jest.fn(),
    getWatchlist: jest.fn(),
    getHistory: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicUsersController],
      providers: [
        { provide: UsersService, useValue: usersService },
        { provide: PublicUserMediaService, useValue: publicUserMediaService },
      ],
    }).compile();

    controller = module.get<PublicUsersController>(PublicUsersController);
    jest.clearAllMocks();
  });

  it('should return public profile when visible', async () => {
    const profile = {
      id: 'u1',
      username: 'john',
      avatarUrl: null,
      bio: null,
      location: null,
      website: null,
      createdAt: new Date(),
      privacy: {
        isProfilePublic: true,
        showWatchHistory: true,
        showRatings: true,
        allowFollowers: true,
      },
    };

    usersService.getPublicProfileByUsername.mockResolvedValue(profile);

    const result = await controller.getPublicProfile('john', { id: 'viewer-1', role: 'user' });

    expect(usersService.getPublicProfileByUsername).toHaveBeenCalledWith('john', {
      id: 'viewer-1',
      role: 'user',
    });
    expect(result).toEqual(profile);
  });

  it('should throw NotFound when profile is not visible', async () => {
    usersService.getPublicProfileByUsername.mockResolvedValue(null);

    await expect(controller.getPublicProfile('private-user', null)).rejects.toThrow(
      NotFoundException,
    );
    expect(usersService.getPublicProfileByUsername).toHaveBeenCalledWith('private-user', null);
  });

  it('ratings should throw NotFound when section not visible', async () => {
    publicUserMediaService.getRatings.mockResolvedValue(null);

    await expect(
      controller.getRatings('john', null, { limit: 20, offset: 0 } as any),
    ).rejects.toThrow(NotFoundException);
  });

  it('watchlist should return list when visible', async () => {
    publicUserMediaService.getWatchlist.mockResolvedValue([{ id: 's1' }]);
    const res = await controller.getWatchlist('john', { id: 'v1', role: 'user' }, {
      limit: 20,
      offset: 0,
    } as any);
    expect(res).toEqual([{ id: 's1' }]);
  });
});
