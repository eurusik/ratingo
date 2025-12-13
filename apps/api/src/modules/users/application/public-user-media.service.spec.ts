import { Test } from '@nestjs/testing';
import { PublicUserMediaService } from './public-user-media.service';
import { UsersService } from './users.service';
import { UserMediaService } from '../../user-media/application/user-media.service';

describe('PublicUserMediaService', () => {
  const usersService = {
    getByUsername: jest.fn(),
  };

  const userMediaService = {
    listWithMedia: jest.fn(),
  };

  const makeUser = (overrides?: Partial<any>) =>
    ({
      id: 'u1',
      email: 'u1@example.com',
      username: 'john',
      isProfilePublic: true,
      showRatings: true,
      showWatchHistory: true,
      allowFollowers: true,
      ...overrides,
    }) as any;

  const makeState = (overrides?: Partial<any>) =>
    ({
      id: 's1',
      userId: 'u1',
      mediaItemId: 'mid-1',
      state: 'completed',
      rating: 90,
      progress: { seasons: { 1: 3 } },
      notes: 'secret',
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
      updatedAt: new Date('2020-01-02T00:00:00.000Z'),
      mediaSummary: {
        id: 'mid-1',
        type: 'movie',
        title: 'Title',
        slug: 'slug',
        poster: null,
        releaseDate: new Date('2010-01-01T00:00:00.000Z'),
      },
      ...overrides,
    }) as any;

  let service: PublicUserMediaService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PublicUserMediaService,
        { provide: UsersService, useValue: usersService },
        { provide: UserMediaService, useValue: userMediaService },
      ],
    }).compile();

    service = moduleRef.get(PublicUserMediaService);
    jest.clearAllMocks();
  });

  it('getRatings: returns null when user not found', async () => {
    usersService.getByUsername.mockResolvedValue(null);
    const res = await service.getRatings('john', null, { limit: 20, offset: 0 } as any);
    expect(res).toBeNull();
  });

  it('getRatings: guest sees progress/notes as null', async () => {
    const user = makeUser({ isProfilePublic: true, showRatings: true });
    usersService.getByUsername.mockResolvedValue(user);
    userMediaService.listWithMedia.mockResolvedValue([makeState()]);

    const res = await service.getRatings('john', null, {
      limit: 20,
      offset: 0,
      sort: 'recent',
    } as any);

    expect(userMediaService.listWithMedia).toHaveBeenCalledWith(user.id, 20, 0, {
      ratedOnly: true,
      sort: 'recent',
    });
    expect(res![0].progress).toBeNull();
    expect(res![0].notes).toBeNull();
  });

  it('getRatings: owner sees progress/notes', async () => {
    const user = makeUser({ isProfilePublic: true, showRatings: false });
    usersService.getByUsername.mockResolvedValue(user);
    userMediaService.listWithMedia.mockResolvedValue([makeState()]);

    const res = await service.getRatings('john', { id: user.id, role: 'user' }, {
      limit: 20,
      offset: 0,
      sort: 'rating',
    } as any);

    expect(userMediaService.listWithMedia).toHaveBeenCalledWith(user.id, 20, 0, {
      ratedOnly: true,
      sort: 'rating',
    });
    expect(res![0].progress).toEqual({ seasons: { 1: 3 } });
    expect(res![0].notes).toBe('secret');
  });

  it('getWatchlist: forwards planned states and sort', async () => {
    const user = makeUser({ isProfilePublic: true, showWatchHistory: true });
    usersService.getByUsername.mockResolvedValue(user);
    userMediaService.listWithMedia.mockResolvedValue([
      makeState({ state: 'planned', rating: null }),
    ]);

    await service.getWatchlist('john', null, { limit: 10, offset: 5, sort: 'releaseDate' } as any);

    expect(userMediaService.listWithMedia).toHaveBeenCalledWith(user.id, 10, 5, {
      states: ['planned'],
      sort: 'releaseDate',
    });
  });

  it('getHistory: forwards watching/completed states and sort', async () => {
    const user = makeUser({ isProfilePublic: true, showWatchHistory: true });
    usersService.getByUsername.mockResolvedValue(user);
    userMediaService.listWithMedia.mockResolvedValue([
      makeState({ state: 'watching', rating: null }),
      makeState({ state: 'completed' }),
    ]);

    await service.getHistory('john', null, { limit: 1, offset: 0, sort: 'recent' } as any);

    expect(userMediaService.listWithMedia).toHaveBeenCalledWith(user.id, 1, 0, {
      states: ['watching', 'completed'],
      sort: 'recent',
    });
  });
});
