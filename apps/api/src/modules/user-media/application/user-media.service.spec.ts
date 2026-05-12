import { BadRequestException } from '@nestjs/common';

import { MediaType } from '../../../common/enums/media-type.enum';
import { USER_MEDIA_STATE } from '../domain/entities/user-media-state.entity';
import { UserMediaRatingChangedEvent } from '../domain/events/user-media-rating-changed.event';
import { UserMediaStateChangedEvent } from '../domain/events/user-media-state-changed.event';

import { UserMediaService } from './user-media.service';

describe('UserMediaService', () => {
  const repo = {
    upsert: jest.fn(),
    updateStateIfIn: jest.fn(),
    findOne: jest.fn(),
    findOneWithMedia: jest.fn(),
    listByUser: jest.fn(),
    listWithMedia: jest.fn(),
    findManyByMediaIds: jest.fn(),
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
    service = new UserMediaService(repo as any, cards as any, eventEmitter as any);
  });

  it('setState should delegate to repo.upsert', async () => {
    repo.upsert.mockResolvedValue({ id: 's1' } as any);

    const result = await service.setState({
      userId: 'u1',
      mediaItemId: 'm1',
      state: USER_MEDIA_STATE.WATCHING,
      rating: null,
      progress: null,
      notes: null,
    });

    expect(repo.upsert).toHaveBeenCalled();
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
      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ state: USER_MEDIA_STATE.WATCHING, rating: 85 }),
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

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ state: USER_MEDIA_STATE.COMPLETED, rating: 85 }),
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

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ state: USER_MEDIA_STATE.WATCHING, rating: 70 }),
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

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ state: USER_MEDIA_STATE.COMPLETED, rating: 50 }),
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

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ state: USER_MEDIA_STATE.WATCHING, rating: null }),
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
    repo.upsert.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.PAUSED } as any);

    await service.setState({
      userId: 'u1',
      mediaItemId: 'm1',
      state: USER_MEDIA_STATE.PAUSED,
      rating: null,
      progress: null,
      notes: null,
    });

    expect(repo.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        mediaItemId: 'm1',
        state: USER_MEDIA_STATE.PAUSED,
        progress: null,
      }),
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

    it('should not emit event when called via syncRating (loop prevention)', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.WATCHING } as any);
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 85,
      } as any);

      await service.syncRating('u1', 'm1', 85);

      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
    });

    it('should emit event for rating 0 (falsy edge case)', async () => {
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
      repo.upsert.mockRejectedValue(new Error('DB error'));

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
    it('should upsert directly without emitting events', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.WATCHING } as any);
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 85,
      } as any);

      await service.syncRating('u1', 'm1', 85);

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', mediaItemId: 'm1', rating: 85 }),
      );
      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
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

    it('should accept null rating', async () => {
      repo.findOne.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.WATCHING } as any);
      repo.upsert.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: null,
      } as any);

      await service.syncRating('u1', 'm1', null);

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1', mediaItemId: 'm1', rating: null }),
      );
      expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
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
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(repo.upsert).not.toHaveBeenCalled();
    });

    it('allows drop for a show in watching state with rating but NO progress', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 80,
        progress: null,
      } as any);
      repo.upsert.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.DROPPED } as any);

      await service.setState(
        {
          userId: 'u1',
          mediaItemId: 'm1',
          state: USER_MEDIA_STATE.DROPPED,
        },
        MediaType.SHOW,
      );

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ state: USER_MEDIA_STATE.DROPPED }),
      );
    });

    it('allows drop for a show in watching state without a rating', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: null,
        progress: { seasons: { 1: 3 } },
      } as any);
      repo.upsert.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.DROPPED } as any);

      await service.setState(
        {
          userId: 'u1',
          mediaItemId: 'm1',
          state: USER_MEDIA_STATE.DROPPED,
        },
        MediaType.SHOW,
      );

      expect(repo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ state: USER_MEDIA_STATE.DROPPED }),
      );
    });

    it('allows drop for a show in caught_up state with a rating', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.CAUGHT_UP,
        rating: 80,
        progress: { seasons: { 1: 10 } },
      } as any);
      repo.upsert.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.DROPPED } as any);

      await service.setState(
        {
          userId: 'u1',
          mediaItemId: 'm1',
          state: USER_MEDIA_STATE.DROPPED,
        },
        MediaType.SHOW,
      );

      expect(repo.upsert).toHaveBeenCalled();
    });

    it('allows drop for a movie in watching state with a rating', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1',
        state: USER_MEDIA_STATE.WATCHING,
        rating: 80,
        progress: null,
      } as any);
      repo.upsert.mockResolvedValue({ id: 's1', state: USER_MEDIA_STATE.DROPPED } as any);

      await service.setState(
        {
          userId: 'u1',
          mediaItemId: 'm1',
          state: USER_MEDIA_STATE.DROPPED,
        },
        MediaType.MOVIE,
      );

      expect(repo.upsert).toHaveBeenCalled();
    });
  });
});
