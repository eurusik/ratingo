import { Test, TestingModule } from '@nestjs/testing';

import { USER_MEDIA_STATE } from '../../domain/entities/user-media-state.entity';
import { UserMediaService } from '../../application/user-media.service';

import { UserMediaController } from './user-media.controller';

describe('UserMediaController', () => {
  let controller: UserMediaController;
  const userMediaService = {
    getStateWithMedia: jest.fn(),
    setState: jest.fn(),
    listWithMedia: jest.fn(),
    listContinueWithMedia: jest.fn(),
    findMany: jest.fn(),
    pauseMedia: jest.fn(),
    resumeMedia: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserMediaController],
      providers: [{ provide: UserMediaService, useValue: userMediaService }],
    }).compile();

    controller = module.get(UserMediaController);
    jest.clearAllMocks();
  });

  it('getState should call service.getStateWithMedia', async () => {
    userMediaService.getStateWithMedia.mockResolvedValue({ id: 's1' } as any);

    const result = await controller.getState({ id: 'u1' }, 'm1');

    expect(userMediaService.getStateWithMedia).toHaveBeenCalledWith('u1', 'm1');
    expect(result).toEqual({ id: 's1' });
  });

  it('setState should only pass explicitly provided fields to service', async () => {
    userMediaService.setState.mockResolvedValue({ id: 's1' } as any);
    userMediaService.getStateWithMedia.mockResolvedValue({
      id: 's1',
      mediaSummary: { poster: null },
    } as any);

    const body = {
      state: USER_MEDIA_STATE.WATCHING,
      rating: undefined,
      progress: undefined,
      notes: undefined,
    };

    const result = await controller.setState({ id: 'u1' }, 'm1', body as any);

    expect(userMediaService.setState).toHaveBeenCalledWith(
      { userId: 'u1', mediaItemId: 'm1', state: USER_MEDIA_STATE.WATCHING },
      undefined,
    );
    expect(userMediaService.getStateWithMedia).toHaveBeenCalledWith('u1', 'm1');
    expect(result).toEqual({ id: 's1', mediaSummary: { poster: null } });
  });

  it('setState should pass rating/progress/notes when explicitly provided', async () => {
    userMediaService.setState.mockResolvedValue({ id: 's1' } as any);
    userMediaService.getStateWithMedia.mockResolvedValue({
      id: 's1',
      mediaSummary: { poster: null },
    } as any);

    const body = {
      state: USER_MEDIA_STATE.COMPLETED,
      rating: 85,
      progress: null,
      notes: 'Great show',
    };

    await controller.setState({ id: 'u1' }, 'm1', body as any);

    expect(userMediaService.setState).toHaveBeenCalledWith(
      {
        userId: 'u1',
        mediaItemId: 'm1',
        state: USER_MEDIA_STATE.COMPLETED,
        rating: 85,
        progress: null,
        notes: 'Great show',
      },
      undefined,
    );
  });

  it('list should parse limit/offset and call service.listWithMedia', async () => {
    userMediaService.listWithMedia.mockResolvedValue([{ id: 's1' }] as any);

    const result = await controller.list({ id: 'u1' }, '10' as any, '5' as any);

    expect(userMediaService.listWithMedia).toHaveBeenCalledWith('u1', 10, 5);
    expect(result).toEqual([{ id: 's1' }]);
  });

  it('listContinue should parse limit/offset and call service.listContinueWithMedia', async () => {
    userMediaService.listContinueWithMedia.mockResolvedValue([{ id: 's1' }] as any);

    const result = await controller.listContinue({ id: 'u1' }, '10' as any, '5' as any);

    expect(userMediaService.listContinueWithMedia).toHaveBeenCalledWith('u1', 10, 5);
    expect(result).toEqual([{ id: 's1' }]);
  });

  describe('batchRatings', () => {
    it('should pass pre-validated IDs to service and return ratings map', async () => {
      const ids = ['550e8400-e29b-41d4-a716-446655440000', '7c9e6679-7425-40de-944b-e07fc1f90ae7'];
      userMediaService.findMany.mockResolvedValue([
        { mediaItemId: ids[0], rating: 85 },
        { mediaItemId: ids[1], rating: null },
      ] as any);

      const result = await controller.batchRatings({ id: 'u1' }, { ids } as any);

      expect(userMediaService.findMany).toHaveBeenCalledWith('u1', ids);
      expect(result).toEqual({ ratings: { [ids[0]]: 85 } });
    });

    it('should return empty ratings when service returns no states', async () => {
      userMediaService.findMany.mockResolvedValue([]);

      const result = await controller.batchRatings({ id: 'u1' }, {
        ids: ['550e8400-e29b-41d4-a716-446655440000'],
      } as any);

      expect(result).toEqual({ ratings: {} });
    });
  });

  describe('pauseMedia', () => {
    it('should pause media and return updated state with media', async () => {
      userMediaService.pauseMedia.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.PAUSED,
      } as any);
      userMediaService.getStateWithMedia.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.PAUSED,
        mediaSummary: { poster: null },
      } as any);

      const result = await controller.pauseMedia({ id: 'u1' }, 'm1');

      expect(userMediaService.pauseMedia).toHaveBeenCalledWith('u1', 'm1');
      expect(userMediaService.getStateWithMedia).toHaveBeenCalledWith('u1', 'm1');
      expect(result).toEqual({
        id: 's1',
        state: USER_MEDIA_STATE.PAUSED,
        mediaSummary: { poster: null },
      });
    });
  });

  describe('resumeMedia', () => {
    it('should resume media and return updated state with media', async () => {
      userMediaService.resumeMedia.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
      } as any);
      userMediaService.getStateWithMedia.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        mediaSummary: { poster: null },
      } as any);

      const result = await controller.resumeMedia({ id: 'u1' }, 'm1');

      expect(userMediaService.resumeMedia).toHaveBeenCalledWith('u1', 'm1');
      expect(userMediaService.getStateWithMedia).toHaveBeenCalledWith('u1', 'm1');
      expect(result).toEqual({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        mediaSummary: { poster: null },
      });
    });
  });
});
