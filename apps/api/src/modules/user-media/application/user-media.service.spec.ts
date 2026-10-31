import { BadRequestException } from '@nestjs/common';

import { ErrorCode } from '../../../common/enums/error-code.enum';
import { AppException } from '../../../common/exceptions/app.exception';
import { MediaType } from '../../../common/enums/media-type.enum';
import { USER_MEDIA_STATE } from '../domain/entities/user-media-state.entity';
import { UserMediaRatingChangedEvent } from '../domain/events/user-media-rating-changed.event';
import { UserMediaStateChangedEvent } from '../domain/events/user-media-state-changed.event';

import { UserMediaService } from './user-media.service';

describe('UserMediaService', () => {
  const repo = {
    upsert: jest.fn(),
    upsertWithGuard: jest.fn(),
    updateStateIfIn: jest.fn(),
    findOne: jest.fn(),
    findOneWithMedia: jest.fn(),
    listByUser: jest.fn(),
    listWithMedia: jest.fn(),
    findManyByMediaIds: jest.fn(),
    delete: jest.fn(),
  };

  const mediaLookup = {
    findTypeById: jest.fn(),
  };

  const cards = {
    enrichUserMedia: jest.fn((items: any[]) => items),
  };

  const eventEmitter = {
    emit: jest.fn(),
    emitAsync: jest.fn().mockResolvedValue([]),
  };

  let service: UserMediaService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: lookup finds nothing -> the (client) mediaType hint is used as fallback
    mediaLookup.findTypeById.mockResolvedValue(null);

    // Default: upsertWithGuard simulates the transactional behavior by calling
    // guard with the value currently returned by findOne (the "locked" row),
    // then resolves with the upsert mock's value.
    repo.upsertWithGuard.mockImplementation(async (_data: any, guard: (e: any) => void) => {
      const existing = await repo.findOne();
      guard(existing);
      return repo.upsert();
    });

    service = new UserMediaService(
      repo as any,
      cards as any,
      eventEmitter as any,
      mediaLookup as any,
    );
  });

  it('setState should delegate to repo.upsertWithGuard (no progress path)', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.upsert.mockResolvedValue({ id: 's1' } as any);

    const result = await service.setState({
      userId: 'u1',
      mediaItemId: 'm1',
      state: USER_MEDIA_STATE.WATCHING,
      rating: null,
      progress: null,
      notes: null,
    });

    expect(repo.upsertWithGuard).toHaveBeenCalled();
    expect(result).toEqual({ id: 's1' });
  });

  it('setState should auto-upgrade state to watching when progress is provided', async () => {
    repo.upsert.mockResolvedValue({ id: 's1' } as any);

    await service.setState({
      userId: 'u1',
      mediaItemId: 'm1',
      state: USER_MEDIA_STATE.PLANNED,
      rating: null,
      progress: { seasons: { 1: 3 } },
      notes: null,
    });

    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        mediaItemId: 'm1',
        state: USER_MEDIA_STATE.WATCHING,
        progress: { seasons: { 1: 3 } },
      }),
    );
  });

  it('setState should reject progress for completed state', async () => {
    await expect(
      service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        state: USER_MEDIA_STATE.COMPLETED,
        rating: null,
        progress: { seasons: { 1: 3 } },
        notes: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('setState should reject progress for dropped state', async () => {
    await expect(
      service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        state: USER_MEDIA_STATE.DROPPED,
        rating: null,
        progress: { seasons: { 1: 3 } },
        notes: null,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('setState should auto-upgrade paused state to watching when progress is provided', async () => {
    repo.upsert.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.WATCHING } as any);

    await service.setState({
      userId: 'u1',
      mediaItemId: 'm1',
      state: USER_MEDIA_STATE.PAUSED,
      rating: null,
      progress: { seasons: { 1: 5 } },
      notes: null,
    });

    // Same behavior as planned - progress implies watching
    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        mediaItemId: 'm1',
        state: USER_MEDIA_STATE.WATCHING,
        progress: { seasons: { 1: 5 } },
      }),
    );
  });

  describe('setState rating-only (no state)', () => {
    it('should preserve existing state when state is omitted', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.WATCHING } as any);
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 85,
      } as any);

      await service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        rating: 85,
      });

      expect(repo.findOne).toHaveBeenCalledWith('u1', 'm1');
      expect(repo.upsertWithGuard).toHaveBeenCalledWith(
        expect.objectContaining({ state: USER_MEDIA_STATE.WATCHING, rating: 85 }),
        expect.any(Function),
      );
    });

    it('should default to completed for movies when no existing state', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.COMPLETED,
        rating: 85,
      } as any);

      await service.setState({ userId: 'u1', mediaItemId: 'm1', rating: 85 }, MediaType.MOVIE);

      expect(repo.upsertWithGuard).toHaveBeenCalledWith(
        expect.objectContaining({ state: USER_MEDIA_STATE.COMPLETED, rating: 85 }),
        expect.any(Function),
      );
    });

    it('should default to watching for shows when no existing state', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 70,
      } as any);

      await service.setState({ userId: 'u1', mediaItemId: 'm1', rating: 70 }, MediaType.SHOW);

      expect(repo.upsertWithGuard).toHaveBeenCalledWith(
        expect.objectContaining({ state: USER_MEDIA_STATE.WATCHING, rating: 70 }),
        expect.any(Function),
      );
    });

    it('should default to completed when no existing state and no mediaType', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.COMPLETED,
        rating: 50,
      } as any);

      await service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        rating: 50,
      });

      expect(repo.upsertWithGuard).toHaveBeenCalledWith(
        expect.objectContaining({ state: USER_MEDIA_STATE.COMPLETED, rating: 50 }),
        expect.any(Function),
      );
    });

    it('should handle clearing rating (null) with existing state', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.WATCHING } as any);
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: null,
      } as any);

      await service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        rating: null,
      });

      expect(repo.upsertWithGuard).toHaveBeenCalledWith(
        expect.objectContaining({ state: USER_MEDIA_STATE.WATCHING, rating: null }),
        expect.any(Function),
      );
    });

    it('should return null when clearing rating with no existing state', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        rating: null,
      });

      expect(result).toBeNull();
      expect(repo.upsert).not.toHaveBeenCalled();
    });
  });

  it('setState should allow paused state without progress', async () => {
    repo.findOne.mockResolvedValue(null);
    repo.upsert.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.PAUSED } as any);

    await service.setState({
      userId: 'u1',
      mediaItemId: 'm1',
      state: USER_MEDIA_STATE.PAUSED,
      rating: null,
      progress: null,
      notes: null,
    });

    expect(repo.upsertWithGuard).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        mediaItemId: 'm1',
        state: USER_MEDIA_STATE.PAUSED,
        progress: null,
      }),
      expect.any(Function),
    );
  });

  it('getStateWithMedia should delegate to repo.findOneWithMedia', async () => {
    repo.findOneWithMedia.mockResolvedValue({ id: 's1', mediaSummary: { poster: null } } as any);

    const result = await service.getStateWithMedia('u1', 'm1');

    expect(repo.findOneWithMedia).toHaveBeenCalledWith('u1', 'm1');
    expect(result).toEqual({ id: 's1', mediaSummary: { poster: null } });
  });

  it('listWithMedia should delegate to repo.listWithMedia', async () => {
    repo.listWithMedia.mockResolvedValue([{ id: 's1' }] as any);

    const result = await service.listWithMedia('u1', 20, 0);

    expect(repo.listWithMedia).toHaveBeenCalledWith('u1', 20, 0, undefined);
    expect(result).toEqual([{ id: 's1' }]);
  });

  it('findMany should delegate to repo.findManyByMediaIds', async () => {
    repo.findManyByMediaIds.mockResolvedValue([{ id: 's1', mediaItemId: 'm1' }] as any);

    const result = await service.findMany('u1', ['m1']);

    expect(repo.findManyByMediaIds).toHaveBeenCalledWith('u1', ['m1']);
    expect(result).toEqual([{ id: 's1', mediaItemId: 'm1' }]);
  });

  describe('rating changed event (setState -> event)', () => {
    it('should emit event when rating is set via setState', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 85,
      } as any);

      await service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 85,
      });

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        UserMediaRatingChangedEvent.eventName,
        expect.objectContaining({ userId: 'u1', mediaItemId: 'm1', rating: 85 }),
      );
    });

    it('should not emit rating event when only state changes (rating not provided)', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.COMPLETED,
      } as any);

      await service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        state: USER_MEDIA_STATE.COMPLETED,
        progress: null,
        notes: null,
      });

      expect(eventEmitter.emitAsync).not.toHaveBeenCalledWith(
        UserMediaRatingChangedEvent.eventName,
        expect.anything(),
      );
    });

    it('should not emit rating event when rating is undefined', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
      } as any);

      await service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        state: USER_MEDIA_STATE.WATCHING,
      });

      expect(eventEmitter.emitAsync).not.toHaveBeenCalledWith(
        UserMediaRatingChangedEvent.eventName,
        expect.anything(),
      );
    });

    it('should not emit event when syncRating does not change the rating (loop prevention)', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 85,
      } as any);
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 85,
      } as any);

      await service.syncRating('u1', 'm1', 85);

      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    });

    it('should emit event for rating 0 (falsy edge case)', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.COMPLETED,
        rating: 0,
      } as any);

      await service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        state: USER_MEDIA_STATE.COMPLETED,
        rating: 0,
      });

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        UserMediaRatingChangedEvent.eventName,
        expect.objectContaining({ userId: 'u1', mediaItemId: 'm1', rating: 0 }),
      );
    });

    it('should emit event when rating is cleared (null) with existing state', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.WATCHING } as any);
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: null,
      } as any);

      await service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        rating: null,
      });

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        UserMediaRatingChangedEvent.eventName,
        expect.objectContaining({ userId: 'u1', mediaItemId: 'm1', rating: null }),
      );
    });

    it('should not emit event when upsert fails', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.upsertWithGuard.mockRejectedValue(new Error('DB error'));

      await expect(
        service.setState({
          userId: 'u1',
          mediaItemId: 'm1',
          state: USER_MEDIA_STATE.WATCHING,
          rating: 85,
        }),
      ).rejects.toThrow('DB error');

      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    });

    it('should emit event when rating is set with progress', async () => {
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 75,
      } as any);

      await service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 75,
        progress: { seasons: { 1: 3 } },
      });

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        UserMediaRatingChangedEvent.eventName,
        expect.objectContaining({ userId: 'u1', mediaItemId: 'm1', rating: 75 }),
      );
    });

    it('should swallow emitAsync errors without failing setState', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 85,
      } as any);
      eventEmitter.emitAsync.mockRejectedValue(new Error('Event bus failure'));

      const result = await service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 85,
      });

      expect(result).toEqual(expect.objectContaining({ id: 's1' }));
    });
  });

  describe('syncRating', () => {
    it('should upsert directly and emit a rating-changed event when the rating changed', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 60,
      } as any);
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 85,
      } as any);

      await service.syncRating('u1', 'm1', 85);

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', mediaItemId: 'm1', rating: 85 }),
      );
      expect(eventEmitter.emitAsync).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        UserMediaRatingChangedEvent.eventName,
        new UserMediaRatingChangedEvent('u1', 'm1', 85),
      );
      // never emits state-changed (bypasses setState)
      expect(eventEmitter.emitAsync).not.toHaveBeenCalledWith(
        UserMediaStateChangedEvent.eventName,
        expect.anything(),
      );
    });

    it('should emit rating-changed for a brand new row', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.upsert.mockResolvedValue({ id: 's1' } as any);

      await service.syncRating('u1', 'm1', 70, MediaType.SHOW);

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        UserMediaRatingChangedEvent.eventName,
        new UserMediaRatingChangedEvent('u1', 'm1', 70),
      );
    });

    it('should derive the default state from the server-side media type, not the hint', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.upsert.mockResolvedValue({ id: 's1' } as any);
      mediaLookup.findTypeById.mockResolvedValue('show');

      await service.syncRating('u1', 'm1', 70, MediaType.MOVIE);

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ state: USER_MEDIA_STATE.WATCHING }),
      );
    });

    it('should default to watching for shows when no existing state', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 70,
      } as any);

      await service.syncRating('u1', 'm1', 70, MediaType.SHOW);

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ state: USER_MEDIA_STATE.WATCHING, rating: 70 }),
      );
    });

    it('should handle rating 0 (falsy edge case)', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.COMPLETED } as any);
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.COMPLETED,
        rating: 0,
      } as any);

      await service.syncRating('u1', 'm1', 0);

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', mediaItemId: 'm1', rating: 0 }),
      );
    });

    it('should default to completed for movies when no existing state', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.COMPLETED,
        rating: 90,
      } as any);

      await service.syncRating('u1', 'm1', 90, MediaType.MOVIE);

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ state: USER_MEDIA_STATE.COMPLETED, rating: 90 }),
      );
    });

    it('should accept null rating and emit rating-changed(null) when a rating existed', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 80,
      } as any);
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: null,
      } as any);

      await service.syncRating('u1', 'm1', null);

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', mediaItemId: 'm1', rating: null }),
      );
      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        UserMediaRatingChangedEvent.eventName,
        new UserMediaRatingChangedEvent('u1', 'm1', null),
      );
    });

    it('should not emit when clearing a rating that was already null', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: null,
      } as any);
      repo.upsert.mockResolvedValue({ id: 's1' } as any);

      await service.syncRating('u1', 'm1', null);

      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    });
  });

  describe('deleteState', () => {
    it('should emit rating-changed(null) when the deleted row had a rating', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', rating: 80 } as any);

      await service.deleteState('u1', 'm1');

      expect(repo.delete).toHaveBeenCalledWith('u1', 'm1');
      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        UserMediaRatingChangedEvent.eventName,
        new UserMediaRatingChangedEvent('u1', 'm1', null),
      );
    });

    it('should emit for rating 0 (falsy edge case)', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', rating: 0 } as any);

      await service.deleteState('u1', 'm1');

      expect(eventEmitter.emitAsync).toHaveBeenCalledTimes(1);
    });

    it('should not emit when the deleted row had no rating', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', rating: null } as any);

      await service.deleteState('u1', 'm1');

      expect(repo.delete).toHaveBeenCalled();
      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    });

    it('should not emit when there was no row', async () => {
      repo.findOne.mockResolvedValue(null);

      await service.deleteState('u1', 'm1');

      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    });
  });

  describe('setState — stale progress reset', () => {
    it.each([USER_MEDIA_STATE.COMPLETED, USER_MEDIA_STATE.DROPPED, USER_MEDIA_STATE.PLANNED])(
      'writes progress: null when moving to %s without explicit progress',
      async (state) => {
        repo.findOne.mockResolvedValue({
          id: 's1',
          state: USER_MEDIA_STATE.WATCHING,
          rating: null,
          progress: { seasons: { 1: 3 } },
        } as any);
        repo.upsert.mockResolvedValue({ id: 's1', state } as any);

        await service.setState({ userId: 'u1', mediaItemId: 'm1', state });

        expect(repo.upsertWithGuard).toHaveBeenCalledWith(
          expect.objectContaining({ state, progress: null }),
          expect.any(Function),
        );
      },
    );

    it.each([USER_MEDIA_STATE.WATCHING, USER_MEDIA_STATE.PAUSED])(
      'does not touch progress when moving to %s',
      async (state) => {
        repo.findOne.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.PLANNED } as any);
        repo.upsert.mockResolvedValue({ id: 's1', state } as any);

        await service.setState({ userId: 'u1', mediaItemId: 'm1', state });

        const data = repo.upsertWithGuard.mock.calls[0][0];
        expect(data).not.toHaveProperty('progress');
      },
    );

    it('does not touch progress on a rating-only update (no explicit state)', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.COMPLETED,
        progress: null,
      } as any);
      repo.upsert.mockResolvedValue({ id: 's1' } as any);

      await service.setState({ userId: 'u1', mediaItemId: 'm1', rating: 90 });

      expect(repo.upsertWithGuard.mock.calls[0][0]).not.toHaveProperty('progress');
    });
  });

  describe('pauseMedia', () => {
    it('should pause a watching media item', async () => {
      repo.updateStateIfIn.mockResolvedValue({
        previous: USER_MEDIA_STATE.WATCHING,
        current: { id: 's1', state: USER_MEDIA_STATE.PAUSED },
      } as any);

      const result = await service.pauseMedia('u1', 'm1');

      expect(repo.updateStateIfIn).toHaveBeenCalledWith(
        'u1',
        'm1',
        [USER_MEDIA_STATE.WATCHING, USER_MEDIA_STATE.CAUGHT_UP],
        USER_MEDIA_STATE.PAUSED,
      );
      expect(result.state).toBe(USER_MEDIA_STATE.PAUSED);
    });

    it('should pause a caught_up media item', async () => {
      repo.updateStateIfIn.mockResolvedValue({
        previous: USER_MEDIA_STATE.CAUGHT_UP,
        current: { id: 's1', state: USER_MEDIA_STATE.PAUSED },
      } as any);

      const result = await service.pauseMedia('u1', 'm1');

      expect(result.state).toBe(USER_MEDIA_STATE.PAUSED);
    });

    it('should throw BadRequestException when no state exists', async () => {
      repo.updateStateIfIn.mockResolvedValue(null);
      repo.findOne.mockResolvedValue(null);

      await expect(service.pauseMedia('u1', 'm1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw BadRequestException when item is in invalid state for pause', async () => {
      repo.updateStateIfIn.mockResolvedValue(null);
      repo.findOne.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.COMPLETED } as any);

      await expect(service.pauseMedia('u1', 'm1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw BadRequestException when item is already paused', async () => {
      repo.updateStateIfIn.mockResolvedValue(null);
      repo.findOne.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.PAUSED } as any);

      await expect(service.pauseMedia('u1', 'm1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should emit state changed event with real previous state', async () => {
      repo.updateStateIfIn.mockResolvedValue({
        previous: USER_MEDIA_STATE.CAUGHT_UP,
        current: { id: 's1', state: USER_MEDIA_STATE.PAUSED },
      } as any);

      await service.pauseMedia('u1', 'm1');

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        UserMediaStateChangedEvent.eventName,
        expect.objectContaining({
          userId: 'u1',
          mediaItemId: 'm1',
          newState: USER_MEDIA_STATE.PAUSED,
          previousState: USER_MEDIA_STATE.CAUGHT_UP,
        }),
      );
    });
  });

  describe('state changed event (setState -> event)', () => {
    it('should emit event when state changes', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.WATCHING } as any);
      repo.upsert.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.COMPLETED } as any);

      await service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        state: USER_MEDIA_STATE.COMPLETED,
      });

      expect(repo.upsertWithGuard).toHaveBeenCalled();
      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        UserMediaStateChangedEvent.eventName,
        expect.objectContaining({
          userId: 'u1',
          mediaItemId: 'm1',
          newState: USER_MEDIA_STATE.COMPLETED,
          previousState: USER_MEDIA_STATE.WATCHING,
        }),
      );
    });

    it('should emit event when state is set for the first time', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.upsert.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.WATCHING } as any);

      await service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        state: USER_MEDIA_STATE.WATCHING,
      });

      expect(repo.upsertWithGuard).toHaveBeenCalled();
      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        UserMediaStateChangedEvent.eventName,
        expect.objectContaining({
          userId: 'u1',
          mediaItemId: 'm1',
          newState: USER_MEDIA_STATE.WATCHING,
          previousState: null,
        }),
      );
    });

    it('should not emit event when state does not change', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.WATCHING } as any);
      repo.upsert.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.WATCHING } as any);

      await service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        state: USER_MEDIA_STATE.WATCHING,
      });

      expect(repo.upsertWithGuard).toHaveBeenCalled();
      expect(eventEmitter.emitAsync).not.toHaveBeenCalledWith(
        UserMediaStateChangedEvent.eventName,
        expect.anything(),
      );
    });

    it('should emit event when progress triggers state change to watching', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.upsert.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.WATCHING } as any);

      await service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        state: USER_MEDIA_STATE.PLANNED,
        progress: { seasons: { 1: 3 } },
      });

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        UserMediaStateChangedEvent.eventName,
        expect.objectContaining({
          userId: 'u1',
          mediaItemId: 'm1',
          newState: USER_MEDIA_STATE.WATCHING,
          previousState: null,
        }),
      );
    });

    it('should emit state changed event for dropped state', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.WATCHING } as any);
      repo.upsert.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.DROPPED } as any);

      await service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        state: USER_MEDIA_STATE.DROPPED,
      });

      expect(repo.upsertWithGuard).toHaveBeenCalled();
      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        UserMediaStateChangedEvent.eventName,
        expect.objectContaining({
          userId: 'u1',
          mediaItemId: 'm1',
          newState: USER_MEDIA_STATE.DROPPED,
          previousState: USER_MEDIA_STATE.WATCHING,
        }),
      );
    });

    it('should swallow emitAsync errors without failing setState', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.WATCHING } as any);
      repo.upsert.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.DROPPED } as any);
      eventEmitter.emitAsync.mockRejectedValue(new Error('Event bus failure'));

      const result = await service.setState({
        userId: 'u1',
        mediaItemId: 'm1',
        state: USER_MEDIA_STATE.DROPPED,
      });

      expect(result).toEqual(expect.objectContaining({ id: 's1' }));
    });
  });

  describe('resumeMedia', () => {
    it('should resume a paused media item', async () => {
      repo.updateStateIfIn.mockResolvedValue({
        previous: USER_MEDIA_STATE.PAUSED,
        current: { id: 's1', state: USER_MEDIA_STATE.WATCHING },
      } as any);

      const result = await service.resumeMedia('u1', 'm1');

      expect(repo.updateStateIfIn).toHaveBeenCalledWith(
        'u1',
        'm1',
        [USER_MEDIA_STATE.PAUSED],
        USER_MEDIA_STATE.WATCHING,
      );
      expect(result.state).toBe(USER_MEDIA_STATE.WATCHING);
    });

    it('should throw BadRequestException when no state exists', async () => {
      repo.updateStateIfIn.mockResolvedValue(null);
      repo.findOne.mockResolvedValue(null);

      await expect(service.resumeMedia('u1', 'm1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should throw BadRequestException when item is not paused', async () => {
      repo.updateStateIfIn.mockResolvedValue(null);
      repo.findOne.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.WATCHING } as any);

      await expect(service.resumeMedia('u1', 'm1')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should emit state changed event when resuming', async () => {
      repo.updateStateIfIn.mockResolvedValue({
        previous: USER_MEDIA_STATE.PAUSED,
        current: { id: 's1', state: USER_MEDIA_STATE.WATCHING },
      } as any);

      await service.resumeMedia('u1', 'm1');

      expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
        UserMediaStateChangedEvent.eventName,
        expect.objectContaining({
          userId: 'u1',
          mediaItemId: 'm1',
          newState: USER_MEDIA_STATE.WATCHING,
          previousState: USER_MEDIA_STATE.PAUSED,
        }),
      );
    });

    // S-2 pinning test: documents the known limitation that resume from
    // PAUSED on an ended/100%-watched show returns WATCHING (not COMPLETED).
    // Self-corrects on the next mark-watched via EpisodeProgressService.
    it('pins resume always returns WATCHING regardless of show end-state', async () => {
      repo.updateStateIfIn.mockResolvedValue({
        previous: USER_MEDIA_STATE.PAUSED,
        current: { id: 's1', state: USER_MEDIA_STATE.WATCHING },
      } as any);

      const result = await service.resumeMedia('u1', 'm1');

      expect(result.state).toBe(USER_MEDIA_STATE.WATCHING);
    });
  });

  describe('setState — issue #94 drop guard', () => {
    it('rejects drop for a show in watching state with rating AND partial progress', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 80,
        progress: { seasons: { 1: 3 } },
      } as any);

      await expect(
        service.setState(
          {
            userId: 'u1',
            mediaItemId: 'm1',
            state: USER_MEDIA_STATE.DROPPED,
          },
          MediaType.SHOW,
        ),
      ).rejects.toBeInstanceOf(AppException);

      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('rejects drop bypass via paused state (rating + progress preserved)', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.PAUSED,
        rating: 80,
        progress: { seasons: { 1: 3 } },
      } as any);

      await expect(
        service.setState(
          { userId: 'u1', mediaItemId: 'm1', state: USER_MEDIA_STATE.DROPPED },
          MediaType.SHOW,
        ),
      ).rejects.toBeInstanceOf(AppException);
    });

    it('rejects drop bypass via caught_up state', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.CAUGHT_UP,
        rating: 80,
        progress: { seasons: { 1: 3 } },
      } as any);

      await expect(
        service.setState(
          { userId: 'u1', mediaItemId: 'm1', state: USER_MEDIA_STATE.DROPPED },
          MediaType.SHOW,
        ),
      ).rejects.toBeInstanceOf(AppException);
    });

    it('exposes a stable CANNOT_DROP_PARTIAL_RATING code on the error', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 80,
        progress: { seasons: { 1: 3 } },
      } as any);

      await expect(
        service.setState(
          { userId: 'u1', mediaItemId: 'm1', state: USER_MEDIA_STATE.DROPPED },
          MediaType.SHOW,
        ),
      ).rejects.toMatchObject({ code: ErrorCode.CANNOT_DROP_PARTIAL_RATING });
    });

    it('allows drop for a show with rating but NO progress (whole-show rating)', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 80,
        progress: null,
      } as any);
      repo.upsert.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.DROPPED } as any);

      await service.setState(
        { userId: 'u1', mediaItemId: 'm1', state: USER_MEDIA_STATE.DROPPED },
        MediaType.SHOW,
      );

      expect(repo.upsertWithGuard).toHaveBeenCalledWith(
        expect.objectContaining({ state: USER_MEDIA_STATE.DROPPED }),
        expect.any(Function),
      );
    });

    it('allows drop for a show without a rating', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: null,
        progress: { seasons: { 1: 3 } },
      } as any);
      repo.upsert.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.DROPPED } as any);

      await service.setState(
        { userId: 'u1', mediaItemId: 'm1', state: USER_MEDIA_STATE.DROPPED },
        MediaType.SHOW,
      );

      expect(repo.upsertWithGuard).toHaveBeenCalledWith(
        expect.objectContaining({ state: USER_MEDIA_STATE.DROPPED }),
        expect.any(Function),
      );
    });

    it('allows drop for a movie even with rating + progress', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 80,
        progress: null,
      } as any);
      repo.upsert.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.DROPPED } as any);

      await service.setState(
        { userId: 'u1', mediaItemId: 'm1', state: USER_MEDIA_STATE.DROPPED },
        MediaType.MOVIE,
      );

      expect(repo.upsertWithGuard).toHaveBeenCalled();
    });
  });

  describe('setState — server-side media type', () => {
    it('rejects drop for a show even when the client claims mediaType=movie', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 80,
        progress: { seasons: { 1: 3 } },
      } as any);
      mediaLookup.findTypeById.mockResolvedValue('show');

      await expect(
        service.setState(
          { userId: 'u1', mediaItemId: 'm1', state: USER_MEDIA_STATE.DROPPED },
          MediaType.MOVIE,
        ),
      ).rejects.toBeInstanceOf(AppException);
      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('rejects drop for a show when the client omits mediaType', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 80,
        progress: { seasons: { 1: 3 } },
      } as any);
      mediaLookup.findTypeById.mockResolvedValue('show');

      await expect(
        service.setState({ userId: 'u1', mediaItemId: 'm1', state: USER_MEDIA_STATE.DROPPED }),
      ).rejects.toBeInstanceOf(AppException);
    });

    it('allows drop for a movie even when the client claims mediaType=show', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 80,
        progress: { seasons: { 1: 3 } },
      } as any);
      repo.upsert.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.DROPPED } as any);
      mediaLookup.findTypeById.mockResolvedValue('movie');

      await service.setState(
        { userId: 'u1', mediaItemId: 'm1', state: USER_MEDIA_STATE.DROPPED },
        MediaType.SHOW,
      );

      expect(repo.upsertWithGuard).toHaveBeenCalled();
    });

    it('picks the default state from the looked-up type for a new rating-only row', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.upsert.mockResolvedValue({ id: 's1' } as any);
      mediaLookup.findTypeById.mockResolvedValue('show');

      await service.setState({ userId: 'u1', mediaItemId: 'm1', rating: 70 }, MediaType.MOVIE);

      expect(repo.upsertWithGuard).toHaveBeenCalledWith(
        expect.objectContaining({ state: USER_MEDIA_STATE.WATCHING }),
        expect.any(Function),
      );
    });

    it('does not hit the lookup when the type cannot influence the outcome', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.WATCHING } as any);
      repo.upsert.mockResolvedValue({ id: 's1' } as any);

      await service.setState({ userId: 'u1', mediaItemId: 'm1', state: USER_MEDIA_STATE.PAUSED });

      expect(mediaLookup.findTypeById).not.toHaveBeenCalled();
    });
  });
});
