import { Test, TestingModule } from '@nestjs/testing';

import { USER_MEDIA_STATE } from '../../domain/entities/user-media-state.entity';
import { ImportMediaService } from '../../application/import-media.service';
import { ImportPendingService } from '../../application/import-pending.service';
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

  const importMediaService = {
    import: jest.fn(),
  };

  const importPendingService = {
    getUserBatches: jest.fn().mockResolvedValue([]),
    createPendingBatch: jest.fn(),
    cancelBatch: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserMediaController],
      providers: [
        { provide: UserMediaService, useValue: userMediaService },
        { provide: ImportMediaService, useValue: importMediaService },
        { provide: ImportPendingService, useValue: importPendingService },
      ],
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

  it('setState should handle null return from service (clearing non-existent rating)', async () => {
    userMediaService.setState.mockResolvedValue(null);
    userMediaService.getStateWithMedia.mockResolvedValue(null);

    const body = { rating: null };

    const result = await controller.setState({ id: 'u1' }, 'm1', body as any);

    expect(userMediaService.setState).toHaveBeenCalled();
    expect(userMediaService.getStateWithMedia).toHaveBeenCalledWith('u1', 'm1');
    expect(result).toBeNull();
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

  describe('importMedia', () => {
    it('should call importMediaService.import with normalized ratings and return result', async () => {
      const importResult = {
        imported: 2,
        skipped: 0,
        notFound: 0,
        durationMs: 42,
        details: { imported: [], skipped: [], notFound: [] },
      };
      importMediaService.import.mockResolvedValue(importResult);

      const body = {
        source: 'kinobaza',
        items: [
          { imdbId: 'tt0137523', rating: 8, state: 'completed', title: 'Fight Club', year: 1999 },
          { tmdbId: 550, rating: null, state: 'planned', title: 'Film B' },
        ],
        overwriteExisting: false,
      } as any;

      const result = await controller.importMedia({ id: 'u1' }, body);

      // rating: 8 on 1-10 scale normalizes to 80 on 0-100 scale
      expect(importMediaService.import).toHaveBeenCalledWith({
        userId: 'u1',
        source: 'kinobaza',
        items: [
          {
            imdbId: 'tt0137523',
            tmdbId: undefined,
            rating: 80,
            state: 'completed',
            title: 'Fight Club',
            year: 1999,
          },
          {
            imdbId: undefined,
            tmdbId: 550,
            rating: null,
            state: 'planned',
            title: 'Film B',
            year: undefined,
          },
        ],
        overwriteExisting: false,
      });
      expect(result).toEqual(importResult);
    });

    it('should default overwriteExisting to false when not provided', async () => {
      importMediaService.import.mockResolvedValue({
        imported: 1,
        skipped: 0,
        notFound: 0,
        durationMs: 10,
        details: { imported: [], skipped: [], notFound: [] },
      });

      const body = {
        source: 'kinobaza',
        items: [{ imdbId: 'tt0137523', state: 'completed' }],
        overwriteExisting: undefined,
      } as any;

      await controller.importMedia({ id: 'u1' }, body);

      expect(importMediaService.import).toHaveBeenCalledWith(
        expect.objectContaining({ overwriteExisting: false }),
      );
    });

    it('should pass null rating through as null (no normalization for null)', async () => {
      importMediaService.import.mockResolvedValue({
        imported: 1,
        skipped: 0,
        notFound: 0,
        durationMs: 5,
        details: { imported: [], skipped: [], notFound: [] },
      });

      const body = {
        source: 'kinobaza',
        items: [{ imdbId: 'tt0137523', rating: null, state: 'planned' }],
        overwriteExisting: false,
      } as any;

      await controller.importMedia({ id: 'u1' }, body);

      expect(importMediaService.import).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [expect.objectContaining({ rating: null })],
        }),
      );
    });
  });

  describe('cancelImportBatches', () => {
    it('should call cancelBatch for each batchId', async () => {
      const batchIds = [
        '550e8400-e29b-41d4-a716-446655440000',
        '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      ];

      await controller.cancelImportBatches({ id: 'u1' }, { batchIds } as any);

      expect(importPendingService.cancelBatch).toHaveBeenCalledTimes(2);
      expect(importPendingService.cancelBatch).toHaveBeenCalledWith('u1', batchIds[0]);
      expect(importPendingService.cancelBatch).toHaveBeenCalledWith('u1', batchIds[1]);
    });

    it('should call cancelBatch with correct userId from token', async () => {
      const batchIds = ['550e8400-e29b-41d4-a716-446655440000'];

      await controller.cancelImportBatches({ id: 'user-xyz' }, { batchIds } as any);

      expect(importPendingService.cancelBatch).toHaveBeenCalledWith('user-xyz', batchIds[0]);
    });

    it('should return empty failedBatchIds when all batches cancelled', async () => {
      const result = await controller.cancelImportBatches({ id: 'u1' }, {
        batchIds: ['550e8400-e29b-41d4-a716-446655440000'],
      } as any);

      expect(result).toEqual({ failedBatchIds: [] });
    });
  });

  describe('getImportStatus', () => {
    it('should call getUserBatches and transform batches to DTOs with ISO strings', async () => {
      const createdAt = new Date('2024-06-01T12:00:00.000Z');
      const batches = [
        {
          id: 'batch-uuid-1',
          source: 'kinobaza',
          totalItems: 42,
          completedCount: 35,
          failedCount: 3,
          status: 'processing',
          createdAt,
        },
      ];
      importPendingService.getUserBatches.mockResolvedValue(batches as any);

      const result = await controller.getImportStatus({ id: 'u1' });

      expect(importPendingService.getUserBatches).toHaveBeenCalledWith('u1');
      expect(result).toEqual([
        {
          batchId: 'batch-uuid-1',
          source: 'kinobaza',
          totalItems: 42,
          completedCount: 35,
          failedCount: 3,
          status: 'processing',
          createdAt: '2024-06-01T12:00:00.000Z',
        },
      ]);
    });

    it('should return empty array when user has no batches', async () => {
      importPendingService.getUserBatches.mockResolvedValue([]);

      const result = await controller.getImportStatus({ id: 'u1' });

      expect(importPendingService.getUserBatches).toHaveBeenCalledWith('u1');
      expect(result).toEqual([]);
    });
  });
});
