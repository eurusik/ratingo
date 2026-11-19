import { USER_MEDIA_STATE, UserMediaStateChangedEvent } from '@/modules/user-media/public';

import { ItemRemovedFromForLaterEvent } from '@/modules/user-actions/domain/events/item-removed-from-for-later.event';
import { type SubscriptionsService } from '../subscriptions.service';

import { AutoUnsubscribeOnUnplanListener } from './auto-unsubscribe-on-unplan.listener';

describe('AutoUnsubscribeOnUnplanListener', () => {
  const setup = () => {
    const subscriptionsService = {
      unsubscribeAbandonedAutoPlan: jest.fn().mockResolvedValue(undefined),
    };
    const listener = new AutoUnsubscribeOnUnplanListener(
      subscriptionsService as unknown as SubscriptionsService,
    );
    return { listener, subscriptionsService };
  };

  it('drops automatic reminders when a title leaves planned', async () => {
    const { listener, subscriptionsService } = setup();

    await listener.onStateChanged(
      new UserMediaStateChangedEvent(
        'user-1',
        'movie-1',
        USER_MEDIA_STATE.COMPLETED,
        USER_MEDIA_STATE.PLANNED,
      ),
    );

    expect(subscriptionsService.unsubscribeAbandonedAutoPlan).toHaveBeenCalledWith(
      'user-1',
      'movie-1',
    );
  });

  it('ignores state changes that do not leave planned', async () => {
    const { listener, subscriptionsService } = setup();

    await listener.onStateChanged(
      new UserMediaStateChangedEvent('user-1', 'movie-1', USER_MEDIA_STATE.PLANNED, null),
    );
    await listener.onStateChanged(
      new UserMediaStateChangedEvent(
        'user-1',
        'movie-1',
        USER_MEDIA_STATE.COMPLETED,
        USER_MEDIA_STATE.WATCHING,
      ),
    );

    expect(subscriptionsService.unsubscribeAbandonedAutoPlan).not.toHaveBeenCalled();
  });

  it('drops automatic reminders when a title leaves for later', async () => {
    const { listener, subscriptionsService } = setup();

    await listener.onRemovedFromForLater(new ItemRemovedFromForLaterEvent('user-1', 'movie-1'));

    expect(subscriptionsService.unsubscribeAbandonedAutoPlan).toHaveBeenCalledWith(
      'user-1',
      'movie-1',
    );
  });

  it('logs instead of failing the removal when unsubscribing fails', async () => {
    const { listener, subscriptionsService } = setup();
    subscriptionsService.unsubscribeAbandonedAutoPlan.mockRejectedValue(new Error('db down'));

    await expect(
      listener.onRemovedFromForLater(new ItemRemovedFromForLaterEvent('user-1', 'movie-1')),
    ).resolves.toBeUndefined();
  });
});
