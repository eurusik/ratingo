import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { SubscriptionTriggerService } from './subscription-trigger.service';
import { ShowSyncDiff } from '../../ingestion/domain/interfaces/show-sync-diff.interface';
import { SUBSCRIPTION_TRIGGER } from '../domain/entities/user-subscription.entity';
import { USER_NOTIFICATION_REPOSITORY } from '../domain/repositories/user-notification.repository.interface';
import { USER_SUBSCRIPTION_REPOSITORY } from '../domain/repositories/user-subscription.repository.interface';

describe('SubscriptionTriggerService', () => {
  let service: SubscriptionTriggerService;
  let subscriptionRepo: any;
  let notificationRepo: any;

  const mockDiff: ShowSyncDiff = {
    tmdbId: 12345,
    mediaItemId: 'media-123',
    hasChanges: true,
    changes: {
      newEpisode: {
        season: 2,
        episode: 5,
        airDate: '2025-01-15',
        key: 'S2E5',
      },
    },
  };

  const mockSubscription = {
    id: 'sub-1',
    userId: 'user-1',
    mediaItemId: 'media-123',
  };

  const setup = async (options: { notifiedSubs?: any[] } = {}) => {
    subscriptionRepo = {
      atomicNotifyNewEpisode: jest.fn().mockResolvedValue(options.notifiedSubs ?? []),
      atomicNotifyNewSeason: jest.fn().mockResolvedValue(options.notifiedSubs ?? []),
      deactivateForEndedShow: jest.fn().mockResolvedValue(options.notifiedSubs?.length ?? 0),
    };

    notificationRepo = {
      createMany: jest.fn().mockResolvedValue(options.notifiedSubs?.length ?? 0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionTriggerService,
        { provide: USER_SUBSCRIPTION_REPOSITORY, useValue: subscriptionRepo },
        { provide: USER_NOTIFICATION_REPOSITORY, useValue: notificationRepo },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<SubscriptionTriggerService>(SubscriptionTriggerService);
    return { service, subscriptionRepo, notificationRepo };
  };

  describe('handleShowDiff', () => {
    it('should return empty array when no changes', async () => {
      await setup();

      const diff: ShowSyncDiff = {
        tmdbId: 12345,
        mediaItemId: 'media-123',
        hasChanges: false,
        changes: {},
      };

      const events = await service.handleShowDiff(diff);

      expect(events).toEqual([]);
      expect(subscriptionRepo.atomicNotifyNewEpisode).not.toHaveBeenCalled();
    });

    it('should generate notification events for new episode', async () => {
      await setup({ notifiedSubs: [mockSubscription] });

      const events = await service.handleShowDiff(mockDiff);

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        subscriptionId: 'sub-1',
        userId: 'user-1',
        mediaItemId: 'media-123',
        trigger: SUBSCRIPTION_TRIGGER.NEW_EPISODE,
        payload: {
          tmdbId: 12345,
          episodeKey: 'S2E5',
          airDate: '2025-01-15',
        },
      });
      expect(subscriptionRepo.atomicNotifyNewEpisode).toHaveBeenCalledWith('media-123', 'S2E5');
    });

    it('should not generate duplicate events (atomic dedup)', async () => {
      const { service: svc1 } = await setup({ notifiedSubs: [mockSubscription] });
      const events1 = await svc1.handleShowDiff(mockDiff);
      expect(events1).toHaveLength(1);

      // Second call: repo returns empty (dedup marker already matches)
      const { service: svc2 } = await setup({ notifiedSubs: [] });
      const events2 = await svc2.handleShowDiff(mockDiff);
      expect(events2).toHaveLength(0);
    });

    it('should handle multiple subscriptions', async () => {
      await setup({
        notifiedSubs: [
          { id: 'sub-1', userId: 'user-1', mediaItemId: 'media-123' },
          { id: 'sub-2', userId: 'user-2', mediaItemId: 'media-123' },
        ],
      });

      const events = await service.handleShowDiff(mockDiff);

      expect(events).toHaveLength(2);
      expect(events[0].userId).toBe('user-1');
      expect(events[1].userId).toBe('user-2');
    });
  });

  describe('handleShowDiff - new season', () => {
    const seasonDiff: ShowSyncDiff = {
      tmdbId: 12345,
      mediaItemId: 'media-123',
      hasChanges: true,
      changes: {
        newSeason: {
          seasonNumber: 3,
          airDate: '2025-02-01',
          key: '3',
        },
      },
    };

    it('should generate notification events for new season', async () => {
      await setup({ notifiedSubs: [mockSubscription] });

      const events = await service.handleShowDiff(seasonDiff);

      expect(events).toHaveLength(1);
      expect(events[0].trigger).toBe(SUBSCRIPTION_TRIGGER.NEW_SEASON);
      expect(events[0].payload.seasonNumber).toBe(3);
      expect(subscriptionRepo.atomicNotifyNewSeason).toHaveBeenCalledWith('media-123', 3);
    });

    it('should not duplicate season notifications', async () => {
      await setup({ notifiedSubs: [] });

      const events = await service.handleShowDiff(seasonDiff);

      expect(events).toHaveLength(0);
    });
  });

  describe('handleShowDiff - status changed', () => {
    const statusChangedDiff: ShowSyncDiff = {
      tmdbId: 12345,
      mediaItemId: 'media-123',
      hasChanges: true,
      changes: {
        statusChanged: {
          from: 'Returning Series',
          to: 'Ended',
        },
      },
    };

    it('should deactivate subscriptions when show ends', async () => {
      await setup({ notifiedSubs: [{ id: 'sub-1' }, { id: 'sub-2' }] });

      const events = await service.handleShowDiff(statusChangedDiff);

      expect(events).toHaveLength(0);
      expect(subscriptionRepo.deactivateForEndedShow).toHaveBeenCalledWith('media-123');
    });

    it('should deactivate subscriptions when show is canceled', async () => {
      const canceledDiff: ShowSyncDiff = {
        ...statusChangedDiff,
        changes: {
          statusChanged: {
            from: 'Returning Series',
            to: 'Canceled',
          },
        },
      };

      await setup({ notifiedSubs: [{ id: 'sub-1' }] });

      const events = await service.handleShowDiff(canceledDiff);

      expect(events).toHaveLength(0);
      expect(subscriptionRepo.deactivateForEndedShow).toHaveBeenCalledWith('media-123');
    });

    it('should not deactivate for non-terminal status changes', async () => {
      const nonTerminalDiff: ShowSyncDiff = {
        ...statusChangedDiff,
        changes: {
          statusChanged: {
            from: 'In Production',
            to: 'Returning Series',
          },
        },
      };

      await setup();

      const events = await service.handleShowDiff(nonTerminalDiff);

      expect(events).toHaveLength(0);
      expect(subscriptionRepo.deactivateForEndedShow).not.toHaveBeenCalled();
    });
  });

  describe('show.new-episode event emission', () => {
    it('should emit event when subscriptions exist', async () => {
      const { service: svc } = await setup({ notifiedSubs: [mockSubscription] });
      const module = await Test.createTestingModule({
        providers: [
          SubscriptionTriggerService,
          { provide: USER_SUBSCRIPTION_REPOSITORY, useValue: subscriptionRepo },
          { provide: USER_NOTIFICATION_REPOSITORY, useValue: notificationRepo },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        ],
      }).compile();
      const emitter = module.get(EventEmitter2);
      const triggerService = module.get(SubscriptionTriggerService);

      await triggerService.handleShowDiff(mockDiff);

      expect(emitter.emit).toHaveBeenCalledWith('show.new-episode', {
        mediaItemId: 'media-123',
      });
    });

    it('should emit event even when no subscriptions are notified', async () => {
      const module = await Test.createTestingModule({
        providers: [
          SubscriptionTriggerService,
          {
            provide: USER_SUBSCRIPTION_REPOSITORY,
            useValue: {
              atomicNotifyNewEpisode: jest.fn().mockResolvedValue([]),
              atomicNotifyNewSeason: jest.fn().mockResolvedValue([]),
              deactivateForEndedShow: jest.fn().mockResolvedValue(0),
            },
          },
          {
            provide: USER_NOTIFICATION_REPOSITORY,
            useValue: { createMany: jest.fn().mockResolvedValue(0) },
          },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        ],
      }).compile();
      const emitter = module.get(EventEmitter2);
      const triggerService = module.get(SubscriptionTriggerService);

      await triggerService.handleShowDiff(mockDiff);

      expect(emitter.emit).toHaveBeenCalledWith('show.new-episode', {
        mediaItemId: 'media-123',
      });
    });

    it('should NOT emit event when diff has no newEpisode', async () => {
      const module = await Test.createTestingModule({
        providers: [
          SubscriptionTriggerService,
          {
            provide: USER_SUBSCRIPTION_REPOSITORY,
            useValue: {
              atomicNotifyNewEpisode: jest.fn().mockResolvedValue([]),
              atomicNotifyNewSeason: jest.fn().mockResolvedValue([]),
              deactivateForEndedShow: jest.fn().mockResolvedValue(0),
            },
          },
          {
            provide: USER_NOTIFICATION_REPOSITORY,
            useValue: { createMany: jest.fn().mockResolvedValue(0) },
          },
          { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        ],
      }).compile();
      const emitter = module.get(EventEmitter2);
      const triggerService = module.get(SubscriptionTriggerService);

      const seasonOnlyDiff: ShowSyncDiff = {
        tmdbId: 12345,
        mediaItemId: 'media-123',
        hasChanges: true,
        changes: {
          newSeason: { seasonNumber: 3, airDate: '2025-02-01', key: '3' },
        },
      };

      await triggerService.handleShowDiff(seasonOnlyDiff);

      expect(emitter.emit).not.toHaveBeenCalledWith('show.new-episode', expect.anything());
    });
  });

  describe('persistNotifications', () => {
    it('should persist notifications to database', async () => {
      const { notificationRepo } = await setup({ notifiedSubs: [mockSubscription] });

      await service.handleShowDiff(mockDiff);

      expect(notificationRepo.createMany).toHaveBeenCalledWith([
        expect.objectContaining({
          userId: 'user-1',
          mediaItemId: 'media-123',
          subscriptionId: 'sub-1',
          trigger: 'new_episode',
          payload: expect.objectContaining({
            episodeKey: 'S2E5',
          }),
        }),
      ]);
    });

    it('should not fail if notification persistence fails', async () => {
      const { notificationRepo } = await setup({ notifiedSubs: [mockSubscription] });
      notificationRepo.createMany.mockRejectedValueOnce(new Error('DB error'));

      const events = await service.handleShowDiff(mockDiff);

      expect(events).toHaveLength(1);
    });
  });
});
