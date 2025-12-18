import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from '../../application/subscriptions.service';
import { SUBSCRIPTION_TRIGGER } from '../../domain/entities/user-subscription.entity';

describe('SubscriptionsController', () => {
  let controller: SubscriptionsController;
  let service: jest.Mocked<SubscriptionsService>;

  const mockUser = { id: 'user-id-1' };

  const mockSubscription = {
    id: 'sub-id-1',
    userId: 'user-id-1',
    mediaItemId: 'media-id-1',
    trigger: SUBSCRIPTION_TRIGGER.RELEASE,
    channel: 'push',
    isActive: true,
    lastNotifiedAt: null,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
  };

  const mockSubscriptionWithMedia = {
    ...mockSubscription,
    mediaSummary: {
      id: 'media-id-1',
      type: 'movie' as const,
      title: 'Inception',
      slug: 'inception-2010',
      poster: null,
      releaseDate: new Date('2010-07-16'),
    },
  };

  beforeEach(async () => {
    const mockService = {
      subscribe: jest.fn().mockResolvedValue(mockSubscription),
      unsubscribe: jest.fn().mockResolvedValue(true),
      getActiveTriggersForMedia: jest.fn().mockResolvedValue([SUBSCRIPTION_TRIGGER.RELEASE]),
      listActiveWithMedia: jest
        .fn()
        .mockResolvedValue({ total: 1, data: [mockSubscriptionWithMedia] }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionsController],
      providers: [{ provide: SubscriptionsService, useValue: mockService }],
    }).compile();

    controller = module.get<SubscriptionsController>(SubscriptionsController);
    service = module.get(SubscriptionsService);
  });

  describe('subscribe', () => {
    it('should create subscription and return response', async () => {
      const result = await controller.subscribe(mockUser, 'media-id-1', {
        trigger: SUBSCRIPTION_TRIGGER.RELEASE,
        context: 'verdict',
        reasonKey: 'upcomingHit',
      });

      expect(result).toEqual({
        id: 'sub-id-1',
        mediaItemId: 'media-id-1',
        trigger: SUBSCRIPTION_TRIGGER.RELEASE,
        isActive: true,
        status: {
          triggers: [SUBSCRIPTION_TRIGGER.RELEASE],
          hasRelease: true,
          hasNewSeason: false,
          hasOnStreaming: false,
        },
        createdAt: mockSubscription.createdAt,
      });
      expect(service.subscribe).toHaveBeenCalledWith({
        userId: 'user-id-1',
        mediaItemId: 'media-id-1',
        trigger: SUBSCRIPTION_TRIGGER.RELEASE,
        context: 'verdict',
        reasonKey: 'upcomingHit',
      });
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe and return result', async () => {
      const result = await controller.unsubscribe(mockUser, 'media-id-1', {
        trigger: SUBSCRIPTION_TRIGGER.RELEASE,
        context: 'card',
      });

      expect(result).toEqual({
        unsubscribed: true,
        status: {
          triggers: [SUBSCRIPTION_TRIGGER.RELEASE],
          hasRelease: true,
          hasNewSeason: false,
          hasOnStreaming: false,
        },
      });
      expect(service.unsubscribe).toHaveBeenCalledWith(
        'user-id-1',
        'media-id-1',
        SUBSCRIPTION_TRIGGER.RELEASE,
        'card',
      );
    });
  });

  describe('getStatus', () => {
    it('should return active triggers for media', async () => {
      const result = await controller.getStatus(mockUser, 'media-id-1');

      expect(result).toEqual({
        triggers: [SUBSCRIPTION_TRIGGER.RELEASE],
        hasRelease: true,
        hasNewSeason: false,
        hasOnStreaming: false,
      });
      expect(service.getActiveTriggersForMedia).toHaveBeenCalledWith('user-id-1', 'media-id-1');
    });
  });

  describe('listActive', () => {
    it('should return paginated active subscriptions', async () => {
      const result = await controller.listActive(mockUser, 20, 0);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.hasMore).toBe(false);
      expect(service.listActiveWithMedia).toHaveBeenCalledWith('user-id-1', 20, 0);
    });

    it('should use default pagination values', async () => {
      await controller.listActive(mockUser);

      expect(service.listActiveWithMedia).toHaveBeenCalledWith('user-id-1', 20, 0);
    });

    it('should calculate hasMore correctly', async () => {
      service.listActiveWithMedia.mockResolvedValue({
        total: 50,
        data: Array(20).fill(mockSubscriptionWithMedia),
      });

      const result = await controller.listActive(mockUser, 20, 0);

      expect(result.meta.hasMore).toBe(true);
    });
  });
});
