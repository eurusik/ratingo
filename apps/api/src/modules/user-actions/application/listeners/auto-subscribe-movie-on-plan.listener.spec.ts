import { USER_MEDIA_STATE, UserMediaStateChangedEvent } from '@/modules/user-media/public';

import { type SubscriptionsService } from '../subscriptions.service';

import { AutoSubscribeMovieOnPlanListener } from './auto-subscribe-movie-on-plan.listener';

describe('AutoSubscribeMovieOnPlanListener', () => {
  const setup = () => {
    const subscriptionsService = {
      autoSubscribeForMovie: jest.fn().mockResolvedValue(undefined),
    };
    const listener = new AutoSubscribeMovieOnPlanListener(
      subscriptionsService as unknown as SubscriptionsService,
    );
    return { listener, subscriptionsService };
  };

  it('auto-subscribes when a title moves to planned', async () => {
    const { listener, subscriptionsService } = setup();

    await listener.onStateChanged(
      new UserMediaStateChangedEvent('user-1', 'movie-1', USER_MEDIA_STATE.PLANNED, null),
    );

    expect(subscriptionsService.autoSubscribeForMovie).toHaveBeenCalledWith('user-1', 'movie-1');
  });

  it('ignores other state changes', async () => {
    const { listener, subscriptionsService } = setup();

    await listener.onStateChanged(
      new UserMediaStateChangedEvent('user-1', 'movie-1', USER_MEDIA_STATE.COMPLETED, null),
    );

    expect(subscriptionsService.autoSubscribeForMovie).not.toHaveBeenCalled();
  });

  it('auto-subscribes when a title is saved for later', async () => {
    const { listener, subscriptionsService } = setup();

    await listener.onSavedForLater({ userId: 'user-1', mediaItemId: 'movie-1' });

    expect(subscriptionsService.autoSubscribeForMovie).toHaveBeenCalledWith('user-1', 'movie-1');
  });

  it('keeps the save working when auto-subscribe fails', async () => {
    const { listener, subscriptionsService } = setup();
    subscriptionsService.autoSubscribeForMovie.mockRejectedValue(new Error('db down'));

    await expect(
      listener.onSavedForLater({ userId: 'user-1', mediaItemId: 'movie-1' }),
    ).resolves.toBeUndefined();
  });
});
