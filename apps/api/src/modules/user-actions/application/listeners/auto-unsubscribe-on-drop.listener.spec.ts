import { UserMediaStateChangedEvent } from '../../../user-media/domain/events/user-media-state-changed.event';
import { SUBSCRIPTION_TRIGGER } from '../../domain/entities/user-subscription.entity';
import { SubscriptionsService } from '../subscriptions.service';

import { AutoUnsubscribeOnDropListener } from './auto-unsubscribe-on-drop.listener';

describe('AutoUnsubscribeOnDropListener', () => {
  let listener: AutoUnsubscribeOnDropListener;
  let subscriptionsService: jest.Mocked<Pick<SubscriptionsService, 'unsubscribe'>>;

  beforeEach(() => {
    subscriptionsService = {
      unsubscribe: jest.fn().mockResolvedValue(true),
    };
    listener = new AutoUnsubscribeOnDropListener(subscriptionsService as any);
  });

  it('should unsubscribe from new_season and new_episode when state changes to dropped', async () => {
    const event = new UserMediaStateChangedEvent('user-1', 'media-1', 'dropped', 'watching');

    await listener.handle(event);

    expect(subscriptionsService.unsubscribe).toHaveBeenCalledTimes(2);
    expect(subscriptionsService.unsubscribe).toHaveBeenCalledWith(
      'user-1',
      'media-1',
      SUBSCRIPTION_TRIGGER.NEW_SEASON,
      'auto-dropped',
    );
    expect(subscriptionsService.unsubscribe).toHaveBeenCalledWith(
      'user-1',
      'media-1',
      SUBSCRIPTION_TRIGGER.NEW_EPISODE,
      'auto-dropped',
    );
  });

  it('should ignore non-dropped state changes', async () => {
    const states = ['watching', 'completed', 'planned', 'paused'];

    for (const state of states) {
      const event = new UserMediaStateChangedEvent('user-1', 'media-1', state, 'watching');
      await listener.handle(event);
    }

    expect(subscriptionsService.unsubscribe).not.toHaveBeenCalled();
  });

  it('should not throw when unsubscribe fails', async () => {
    subscriptionsService.unsubscribe.mockRejectedValue(new Error('DB error'));
    const event = new UserMediaStateChangedEvent('user-1', 'media-1', 'dropped', 'watching');

    await expect(listener.handle(event)).resolves.toBeUndefined();
  });
});
