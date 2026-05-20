import { EventEmitter2 } from '@nestjs/event-emitter';

import { UserMediaStateChangedEvent } from '../../domain/events/user-media-state-changed.event';
import type { IUserMediaStateRepository } from '../../domain/repositories/user-media-state.repository.interface';

import { CaughtUpTransitionListener } from './caught-up-transition.listener';

const makeState = (userId: string, mediaItemId = 'media-1') => ({
  id: `${userId}-${mediaItemId}`,
  userId,
  mediaItemId,
  state: 'watching' as const,
  rating: null,
  progress: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('CaughtUpTransitionListener', () => {
  let listener: CaughtUpTransitionListener;
  let repo: jest.Mocked<Pick<IUserMediaStateRepository, 'bulkTransitionCaughtUpToWatching'>>;
  let eventEmitter: jest.Mocked<Pick<EventEmitter2, 'emit'>>;

  beforeEach(() => {
    repo = {
      bulkTransitionCaughtUpToWatching: jest.fn().mockResolvedValue([]),
    };
    eventEmitter = {
      emit: jest.fn(),
    };
    listener = new CaughtUpTransitionListener(repo as any, eventEmitter as any);
  });

  it('should call bulkTransitionCaughtUpToWatching with mediaItemId', async () => {
    await listener.handle({ mediaItemId: 'media-1' });

    expect(repo.bulkTransitionCaughtUpToWatching).toHaveBeenCalledWith('media-1');
  });

  it('should emit state-changed events for each transitioned user', async () => {
    repo.bulkTransitionCaughtUpToWatching.mockResolvedValue([
      makeState('user-1'),
      makeState('user-2'),
      makeState('user-3'),
    ]);

    await listener.handle({ mediaItemId: 'media-1' });

    expect(eventEmitter.emit).toHaveBeenCalledTimes(3);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      UserMediaStateChangedEvent.eventName,
      expect.objectContaining({
        userId: 'user-1',
        mediaItemId: 'media-1',
        previousState: 'caught_up',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      UserMediaStateChangedEvent.eventName,
      expect.objectContaining({
        userId: 'user-2',
        mediaItemId: 'media-1',
        previousState: 'caught_up',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      UserMediaStateChangedEvent.eventName,
      expect.objectContaining({
        userId: 'user-3',
        mediaItemId: 'media-1',
        previousState: 'caught_up',
      }),
    );
  });

  it('should do nothing when no caught_up users are transitioned', async () => {
    repo.bulkTransitionCaughtUpToWatching.mockResolvedValue([]);

    await listener.handle({ mediaItemId: 'media-1' });

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('should not emit events when bulk transition fails', async () => {
    repo.bulkTransitionCaughtUpToWatching.mockRejectedValue(new Error('DB error'));

    await listener.handle({ mediaItemId: 'media-1' });

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('should handle a single transitioned user', async () => {
    repo.bulkTransitionCaughtUpToWatching.mockResolvedValue([makeState('user-1')]);

    await listener.handle({ mediaItemId: 'media-1' });

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      UserMediaStateChangedEvent.eventName,
      expect.objectContaining({ userId: 'user-1', previousState: 'caught_up' }),
    );
  });
});
