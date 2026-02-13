import { UserMediaStateChangedEvent } from '../../../user-media/domain/events/user-media-state-changed.event';
import { SubscriptionsService } from '../subscriptions.service';

import { AutoResubscribeOnRestoreListener } from './auto-resubscribe-on-restore.listener';

describe('AutoResubscribeOnRestoreListener', () => {
  let listener: AutoResubscribeOnRestoreListener;
  let subscriptionsService: jest.Mocked<Pick<SubscriptionsService, 'autoSubscribeForShow'>>;

  beforeEach(() => {
    subscriptionsService = {
      autoSubscribeForShow: jest.fn().mockResolvedValue(undefined),
    };
    listener = new AutoResubscribeOnRestoreListener(subscriptionsService as any);
  });

  it('should call autoSubscribeForShow when state changes from dropped to watching', async () => {
    const event = new UserMediaStateChangedEvent('user-1', 'media-1', 'watching', 'dropped');

    await listener.handle(event);

    expect(subscriptionsService.autoSubscribeForShow).toHaveBeenCalledTimes(1);
    expect(subscriptionsService.autoSubscribeForShow).toHaveBeenCalledWith('user-1', 'media-1');
  });

  it('should ignore events where newState is not watching', async () => {
    const states = ['dropped', 'completed', 'planned', 'paused'];

    for (const state of states) {
      const event = new UserMediaStateChangedEvent('user-1', 'media-1', state, 'dropped');
      await listener.handle(event);
    }

    expect(subscriptionsService.autoSubscribeForShow).not.toHaveBeenCalled();
  });

  it('should ignore events where previousState is not dropped', async () => {
    const previousStates = ['watching', 'completed', 'planned', 'paused', null];

    for (const prev of previousStates) {
      const event = new UserMediaStateChangedEvent('user-1', 'media-1', 'watching', prev);
      await listener.handle(event);
    }

    expect(subscriptionsService.autoSubscribeForShow).not.toHaveBeenCalled();
  });

  it('should not throw when autoSubscribeForShow fails', async () => {
    subscriptionsService.autoSubscribeForShow.mockRejectedValue(new Error('DB error'));
    const event = new UserMediaStateChangedEvent('user-1', 'media-1', 'watching', 'dropped');

    await expect(listener.handle(event)).resolves.toBeUndefined();
  });
});
