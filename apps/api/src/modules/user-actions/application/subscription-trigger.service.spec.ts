import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionTriggerService } from './subscription-trigger.service';
import { DATABASE_CONNECTION } from '../../../database/database.module';
import { ShowSyncDiff } from '../../ingestion/domain/interfaces/show-sync-diff.interface';
import { SUBSCRIPTION_TRIGGER } from '../domain/entities/user-subscription.entity';
import { USER_NOTIFICATION_REPOSITORY } from '../domain/repositories/user-notification.repository.interface';

describe('SubscriptionTriggerService', () => {
  let service: SubscriptionTriggerService;
  let db: any;
  let notificationRepo: any;

  // Mock data
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

  // Mock chain for Drizzle
  const createMockChain = (returnValue: any[] = []) => {
    const chain: any = {
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnValue({
        then: (resolve: any) => resolve(returnValue),
      }),
    };
    return chain;
  };

  const setup = async (options: { updateReturn?: any[] } = {}) => {
    const updateChain = createMockChain(options.updateReturn ?? []);

    db = {
      update: jest.fn().mockReturnValue(updateChain),
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnValue({
          then: (resolve: any) => resolve([]),
        }),
      }),
    };

    notificationRepo = {
      createMany: jest.fn().mockResolvedValue(options.updateReturn?.length ?? 0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionTriggerService,
        { provide: DATABASE_CONNECTION, useValue: db },
        { provide: USER_NOTIFICATION_REPOSITORY, useValue: notificationRepo },
      ],
    }).compile();

    service = module.get<SubscriptionTriggerService>(SubscriptionTriggerService);
    return { service, db, updateChain, notificationRepo };
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
      expect(db.update).not.toHaveBeenCalled();
    });

    it('should generate notification events for new episode', async () => {
      const { updateChain } = await setup({
        updateReturn: [mockSubscription],
      });

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
      expect(db.update).toHaveBeenCalled();
    });

    it('should not generate duplicate events (atomic dedup)', async () => {
      // First call: subscription gets updated, returns the subscription
      const { service: svc1, db: db1 } = await setup({
        updateReturn: [mockSubscription],
      });

      const events1 = await svc1.handleShowDiff(mockDiff);
      expect(events1).toHaveLength(1);

      // Second call: subscription already has the marker, UPDATE returns empty
      // (because WHERE condition with dedup check doesn't match)
      const { service: svc2, db: db2 } = await setup({
        updateReturn: [], // No rows updated = already notified
      });

      const events2 = await svc2.handleShowDiff(mockDiff);
      expect(events2).toHaveLength(0); // No duplicate notification
    });

    it('should handle multiple subscriptions', async () => {
      await setup({
        updateReturn: [
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
      await setup({
        updateReturn: [mockSubscription],
      });

      const events = await service.handleShowDiff(seasonDiff);

      expect(events).toHaveLength(1);
      expect(events[0].trigger).toBe(SUBSCRIPTION_TRIGGER.NEW_SEASON);
      expect(events[0].payload.seasonNumber).toBe(3);
    });

    it('should not duplicate season notifications', async () => {
      // Already notified for season 3
      await setup({
        updateReturn: [], // No rows updated
      });

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
      const { updateChain } = await setup({
        updateReturn: [{ id: 'sub-1' }, { id: 'sub-2' }],
      });

      const events = await service.handleShowDiff(statusChangedDiff);

      // Status change doesn't generate notification events
      expect(events).toHaveLength(0);
      // But it should deactivate subscriptions
      expect(db.update).toHaveBeenCalled();
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
        }),
      );
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

      await setup({ updateReturn: [{ id: 'sub-1' }] });

      const events = await service.handleShowDiff(canceledDiff);

      expect(events).toHaveLength(0);
      expect(db.update).toHaveBeenCalled();
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
      // update should not be called for non-terminal status
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe('persistNotifications', () => {
    it('should persist notifications to database', async () => {
      const { notificationRepo } = await setup({
        updateReturn: [mockSubscription],
      });

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
      const { notificationRepo } = await setup({
        updateReturn: [mockSubscription],
      });
      notificationRepo.createMany.mockRejectedValueOnce(new Error('DB error'));

      // Should not throw
      const events = await service.handleShowDiff(mockDiff);

      expect(events).toHaveLength(1);
    });
  });
});
