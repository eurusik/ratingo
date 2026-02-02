import { Test, TestingModule } from '@nestjs/testing';

import { UserMediaService } from '@/modules/user-media/application/user-media.service';

import { UserStateAdapter } from './user-state.adapter';

describe('UserStateAdapter', () => {
  let adapter: UserStateAdapter;
  let userMediaService: jest.Mocked<Partial<UserMediaService>>;

  beforeEach(async () => {
    userMediaService = {
      getState: jest.fn(),
      findMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UserStateAdapter, { provide: UserMediaService, useValue: userMediaService }],
    }).compile();

    adapter = module.get<UserStateAdapter>(UserStateAdapter);
  });

  describe('getState', () => {
    it('should delegate to userMediaService.getState', async () => {
      const mockState = {
        id: 'state-1',
        userId: 'user-1',
        mediaItemId: 'media-1',
        state: 'watching' as const,
        rating: null,
        progress: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      userMediaService.getState!.mockResolvedValue(mockState);

      const result = await adapter.getState('user-1', 'media-1');

      expect(userMediaService.getState).toHaveBeenCalledWith('user-1', 'media-1');
      expect(result).toEqual(mockState);
    });

    it('should return null when state not found', async () => {
      userMediaService.getState!.mockResolvedValue(null);

      const result = await adapter.getState('user-1', 'media-1');

      expect(result).toBeNull();
    });
  });

  describe('findMany', () => {
    it('should delegate to userMediaService.findMany', async () => {
      const mockStates = [
        {
          id: 'state-1',
          userId: 'user-1',
          mediaItemId: 'media-1',
          state: 'watching' as const,
          rating: 8,
          progress: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'state-2',
          userId: 'user-1',
          mediaItemId: 'media-2',
          state: 'completed' as const,
          rating: 9,
          progress: null,
          notes: 'Great movie!',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      userMediaService.findMany!.mockResolvedValue(mockStates);

      const result = await adapter.findMany('user-1', ['media-1', 'media-2']);

      expect(userMediaService.findMany).toHaveBeenCalledWith('user-1', ['media-1', 'media-2']);
      expect(result).toEqual(mockStates);
    });

    it('should return empty array when no states found', async () => {
      userMediaService.findMany!.mockResolvedValue([]);

      const result = await adapter.findMany('user-1', ['media-1']);

      expect(result).toEqual([]);
    });
  });
});
