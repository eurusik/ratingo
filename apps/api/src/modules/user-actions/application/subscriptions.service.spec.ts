import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from './subscriptions.service';
import { USER_SUBSCRIPTION_REPOSITORY } from '../domain/repositories/user-subscription.repository.interface';
import { USER_MEDIA_ACTION_REPOSITORY } from '../domain/repositories/user-media-action.repository.interface';
import { SUBSCRIPTION_TRIGGER } from '../domain/entities/user-subscription.entity';
import { USER_MEDIA_ACTION } from '../domain/entities/user-media-action.entity';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let subscriptionRepo: any;
  let actionRepo: any;

  const mockSubscription = {
    id: 'sub-id-1',
    userId: 'user-id-1',
    mediaItemId: 'media-id-1',
    trigger: SUBSCRIPTION_TRIGGER.RELEASE,
    channel: 'push',
    isActive: true,
    lastNotifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSubscriptionWithMedia = {
    ...mockSubscription,
    mediaSummary: {
      id: 'media-id-1',
      type: 'movie',
      title: 'Inception',
      slug: 'inception-2010',
      poster: null,
    },
  };

  beforeEach(async () => {
    subscriptionRepo = {
      upsert: jest.fn().mockResolvedValue(mockSubscription),
      deactivate: jest.fn().mockResolvedValue(true),
      findActiveTriggersForMedia: jest.fn().mockResolvedValue([SUBSCRIPTION_TRIGGER.RELEASE]),
      listActiveWithMedia: jest.fn().mockResolvedValue([mockSubscriptionWithMedia]),
      countActive: jest.fn().mockResolvedValue(1),
    };

    actionRepo = {
      create: jest.fn().mockResolvedValue({ id: 'action-id-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        { provide: USER_SUBSCRIPTION_REPOSITORY, useValue: subscriptionRepo },
        { provide: USER_MEDIA_ACTION_REPOSITORY, useValue: actionRepo },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
  });

  describe('subscribe', () => {
    it('should create subscription and log action', async () => {
      const result = await service.subscribe({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        trigger: SUBSCRIPTION_TRIGGER.RELEASE,
        context: 'verdict',
        reasonKey: 'upcomingHit',
      });

      expect(result).toEqual(mockSubscription);
      expect(subscriptionRepo.upsert).toHaveBeenCalledWith({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        trigger: SUBSCRIPTION_TRIGGER.RELEASE,
      });
      expect(actionRepo.create).toHaveBeenCalledWith({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        action: USER_MEDIA_ACTION.SUBSCRIBE,
        context: 'verdict',
        reasonKey: 'upcomingHit',
        payload: { trigger: SUBSCRIPTION_TRIGGER.RELEASE },
      });
    });
  });

  describe('unsubscribe', () => {
    it('should deactivate subscription and log action when deactivated', async () => {
      const result = await service.unsubscribe(
        'user-id-1',
        'media-id-1',
        SUBSCRIPTION_TRIGGER.RELEASE,
        'card',
      );

      expect(result).toBe(true);
      expect(subscriptionRepo.deactivate).toHaveBeenCalledWith(
        'user-id-1',
        'media-id-1',
        SUBSCRIPTION_TRIGGER.RELEASE,
      );
      expect(actionRepo.create).toHaveBeenCalledWith({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        action: USER_MEDIA_ACTION.UNSUBSCRIBE,
        context: 'card',
        payload: { trigger: SUBSCRIPTION_TRIGGER.RELEASE },
      });
    });

    it('should not log action when subscription not found', async () => {
      subscriptionRepo.deactivate.mockResolvedValue(false);

      const result = await service.unsubscribe(
        'user-id-1',
        'media-id-1',
        SUBSCRIPTION_TRIGGER.RELEASE,
      );

      expect(result).toBe(false);
      expect(actionRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('getActiveTriggersForMedia', () => {
    it('should return active triggers for media', async () => {
      const result = await service.getActiveTriggersForMedia('user-id-1', 'media-id-1');

      expect(result).toEqual([SUBSCRIPTION_TRIGGER.RELEASE]);
      expect(subscriptionRepo.findActiveTriggersForMedia).toHaveBeenCalledWith(
        'user-id-1',
        'media-id-1',
      );
    });
  });

  describe('listActiveWithMedia', () => {
    it('should return paginated subscriptions with media', async () => {
      const result = await service.listActiveWithMedia('user-id-1', 20, 0);

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].mediaSummary.title).toBe('Inception');
      expect(subscriptionRepo.countActive).toHaveBeenCalledWith('user-id-1');
      expect(subscriptionRepo.listActiveWithMedia).toHaveBeenCalledWith('user-id-1', 20, 0);
    });
  });
});
