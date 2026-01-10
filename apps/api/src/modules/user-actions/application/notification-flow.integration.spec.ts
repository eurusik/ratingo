/**
 * Integration test for the full notification flow.
 * Tests the complete cycle: subscribe → sync diff → notification created → no duplicates.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SubscriptionsService } from './subscriptions.service';
import { SubscriptionTriggerService } from './subscription-trigger.service';
import { NotificationsService } from './notifications.service';
import { USER_SUBSCRIPTION_REPOSITORY } from '../domain/repositories/user-subscription.repository.interface';
import { USER_MEDIA_ACTION_REPOSITORY } from '../domain/repositories/user-media-action.repository.interface';
import { USER_NOTIFICATION_REPOSITORY } from '../domain/repositories/user-notification.repository.interface';
import { DATABASE_CONNECTION } from '../../../database/database.module';
import { SUBSCRIPTION_TRIGGER } from '../domain/entities/user-subscription.entity';
import type { ShowSyncDiff } from '../../ingestion/public';

describe('Notification Flow Integration', () => {
  let subscriptionsService: SubscriptionsService;
  let triggerService: SubscriptionTriggerService;
  let notificationsService: NotificationsService;

  // In-memory stores to simulate DB
  const subscriptions = new Map<string, any>();
  const notifications: any[] = [];
  const actions: any[] = [];

  // Track dedup markers updates
  let lastUpdateCall: any = null;

  const userId = 'user-123';
  const mediaItemId = 'media-456';

  beforeEach(async () => {
    // Reset stores
    subscriptions.clear();
    notifications.length = 0;
    actions.length = 0;
    lastUpdateCall = null;

    // Mock subscription repository
    const subscriptionRepo = {
      upsert: jest.fn().mockImplementation(async (data) => {
        const key = `${data.userId}-${data.mediaItemId}-${data.trigger}`;
        const existing = subscriptions.get(key);

        const sub = {
          id: existing?.id ?? `sub-${Date.now()}`,
          userId: data.userId,
          mediaItemId: data.mediaItemId,
          trigger: data.trigger,
          channel: 'push',
          isActive: true,
          lastNotifiedSeasonNumber: existing?.isActive
            ? existing.lastNotifiedSeasonNumber // Don't update if already active
            : (data.lastNotifiedSeasonNumber ?? null),
          lastNotifiedEpisodeKey: existing?.isActive
            ? existing.lastNotifiedEpisodeKey
            : (data.lastNotifiedEpisodeKey ?? null),
          lastNotifiedAt: existing?.lastNotifiedAt ?? null,
          createdAt: existing?.createdAt ?? new Date(),
          updatedAt: new Date(),
        };
        subscriptions.set(key, sub);
        return sub;
      }),
      deactivate: jest.fn(),
      findActiveTriggersForMedia: jest.fn(),
      listActiveWithMedia: jest.fn(),
      countActive: jest.fn(),
    };

    // Mock action repository
    const actionRepo = {
      create: jest.fn().mockImplementation(async (data) => {
        const action = { id: `action-${Date.now()}`, ...data };
        actions.push(action);
        return action;
      }),
    };

    // Mock notification repository
    const notificationRepo = {
      createMany: jest.fn().mockImplementation(async (data) => {
        // Simulate dedup via unique constraint
        let created = 0;
        for (const item of data) {
          const exists = notifications.some(
            (n) =>
              n.userId === item.userId &&
              n.mediaItemId === item.mediaItemId &&
              n.trigger === item.trigger &&
              JSON.stringify(n.payload) === JSON.stringify(item.payload),
          );
          if (!exists) {
            notifications.push({
              id: `notif-${Date.now()}-${created}`,
              ...item,
              isRead: false,
              readAt: null,
              createdAt: new Date(),
            });
            created++;
          }
        }
        return created;
      }),
      listWithMedia: jest.fn().mockImplementation(async (uid) => {
        return notifications
          .filter((n) => n.userId === uid)
          .map((n) => ({
            ...n,
            mediaSummary: {
              id: n.mediaItemId,
              type: 'show',
              title: 'Test Show',
              slug: 'test-show',
              poster: null,
            },
          }));
      }),
      countUnread: jest.fn().mockImplementation(async (uid) => {
        return notifications.filter((n) => n.userId === uid && !n.isRead).length;
      }),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
    };

    // Mock DB for SubscriptionsService.getShowCurrentState
    const mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([
        { seasonNumber: 2, episodeNumber: 10 }, // Current aired state: S2E10
      ]),
      // For SubscriptionTriggerService
      update: jest.fn().mockImplementation(() => {
        const setFn = jest.fn().mockImplementation((data) => {
          lastUpdateCall = data;
          return {
            set: setFn,
            where: jest.fn().mockReturnThis(),
            returning: jest.fn().mockImplementation(() => {
              // Return subscriptions that match the update criteria
              const matchingSubs = Array.from(subscriptions.values()).filter(
                (s) => s.mediaItemId === mediaItemId && s.isActive,
              );
              return Promise.resolve(
                matchingSubs.map((s) => ({
                  id: s.id,
                  userId: s.userId,
                  mediaItemId: s.mediaItemId,
                })),
              );
            }),
          };
        });
        return {
          set: setFn,
          where: jest.fn().mockReturnThis(),
          returning: jest.fn().mockResolvedValue([]),
        };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        SubscriptionTriggerService,
        NotificationsService,
        { provide: USER_SUBSCRIPTION_REPOSITORY, useValue: subscriptionRepo },
        { provide: USER_MEDIA_ACTION_REPOSITORY, useValue: actionRepo },
        { provide: USER_NOTIFICATION_REPOSITORY, useValue: notificationRepo },
        { provide: DATABASE_CONNECTION, useValue: mockDb },
      ],
    }).compile();

    subscriptionsService = module.get(SubscriptionsService);
    triggerService = module.get(SubscriptionTriggerService);
    notificationsService = module.get(NotificationsService);
  });

  describe('Invariant 1: No retro notifications on subscribe', () => {
    it('should initialize dedup markers to current state when subscribing', async () => {
      // Act: Subscribe to new_season
      const subscription = await subscriptionsService.subscribe({
        userId,
        mediaItemId,
        trigger: SUBSCRIPTION_TRIGGER.NEW_SEASON,
      });

      // Assert: Dedup marker should be set to current aired season (2)
      expect(subscription.lastNotifiedSeasonNumber).toBe(2);

      // Verify no notifications were created
      const { data, unreadCount } = await notificationsService.listWithMedia(userId);
      expect(data).toHaveLength(0);
      expect(unreadCount).toBe(0);
    });

    it('should initialize episode key for new_episode trigger', async () => {
      // Act: Subscribe to new_episode
      const subscription = await subscriptionsService.subscribe({
        userId,
        mediaItemId,
        trigger: SUBSCRIPTION_TRIGGER.NEW_EPISODE,
      });

      // Assert: Dedup marker should be set to current episode
      expect(subscription.lastNotifiedEpisodeKey).toBe('S2E10');
    });
  });

  describe('Invariant 2: Exactly-once notification per event', () => {
    it('should create notification when new season is detected', async () => {
      // Arrange: Subscribe first
      await subscriptionsService.subscribe({
        userId,
        mediaItemId,
        trigger: SUBSCRIPTION_TRIGGER.NEW_SEASON,
      });

      // Act: Simulate sync detecting new season 3
      const diff: ShowSyncDiff = {
        tmdbId: 12345,
        mediaItemId,
        hasChanges: true,
        changes: {
          newSeason: {
            seasonNumber: 3,
            airDate: '2025-01-15',
            key: '3',
          },
        },
      };

      const events = await triggerService.handleShowDiff(diff);

      // Assert: One notification event generated
      expect(events).toHaveLength(1);
      expect(events[0].trigger).toBe(SUBSCRIPTION_TRIGGER.NEW_SEASON);
      expect(events[0].payload.seasonNumber).toBe(3);

      // Verify notification was persisted
      const { data } = await notificationsService.listWithMedia(userId);
      expect(data).toHaveLength(1);
      expect(data[0].trigger).toBe('new_season');
    });

    it('should NOT create duplicate notification for same event', async () => {
      // Arrange: Subscribe
      await subscriptionsService.subscribe({
        userId,
        mediaItemId,
        trigger: SUBSCRIPTION_TRIGGER.NEW_SEASON,
      });

      const diff: ShowSyncDiff = {
        tmdbId: 12345,
        mediaItemId,
        hasChanges: true,
        changes: {
          newSeason: {
            seasonNumber: 3,
            airDate: '2025-01-15',
            key: '3',
          },
        },
      };

      // Act: Process same diff twice
      await triggerService.handleShowDiff(diff);
      await triggerService.handleShowDiff(diff);

      // Assert: Still only one notification (dedup via onConflictDoNothing)
      const { data } = await notificationsService.listWithMedia(userId);
      expect(data).toHaveLength(1);
    });
  });

  describe('Invariant 3: Read semantics', () => {
    it('should track unread count correctly', async () => {
      // Arrange: Create some notifications directly
      await notificationsService.createFromEvents([
        {
          userId,
          mediaItemId,
          subscriptionId: 'sub-1',
          trigger: SUBSCRIPTION_TRIGGER.NEW_SEASON,
        },
        {
          userId,
          mediaItemId: 'media-789',
          subscriptionId: 'sub-2',
          trigger: SUBSCRIPTION_TRIGGER.NEW_EPISODE,
        },
      ]);

      // Assert: Both unread
      const count = await notificationsService.getUnreadCount(userId);
      expect(count).toBe(2);
    });
  });

  describe('Full flow: Subscribe → Sync → Notification', () => {
    it('should complete full notification cycle', async () => {
      // Step 1: User subscribes to show (currently at S2E10)
      const subscription = await subscriptionsService.subscribe({
        userId,
        mediaItemId,
        trigger: SUBSCRIPTION_TRIGGER.NEW_SEASON,
        context: 'show-page',
      });

      // Verify: Dedup marker initialized, no notifications yet
      expect(subscription.lastNotifiedSeasonNumber).toBe(2);
      expect(notifications).toHaveLength(0);

      // Step 2: Sync job detects new season 3
      const diff: ShowSyncDiff = {
        tmdbId: 12345,
        mediaItemId,
        hasChanges: true,
        changes: {
          newSeason: {
            seasonNumber: 3,
            airDate: '2025-02-01',
            key: '3',
          },
        },
      };

      const events = await triggerService.handleShowDiff(diff);

      // Verify: Notification created
      expect(events).toHaveLength(1);
      expect(events[0].userId).toBe(userId);
      expect(events[0].payload.seasonNumber).toBe(3);

      // Step 3: User checks notifications
      const { data, unreadCount } = await notificationsService.listWithMedia(userId);
      expect(data).toHaveLength(1);
      expect(unreadCount).toBe(1);
      expect(data[0].trigger).toBe('new_season');
      expect(data[0].mediaSummary.title).toBe('Test Show');

      // Step 4: Same sync runs again (idempotency check)
      const events2 = await triggerService.handleShowDiff(diff);

      // Verify: No new notifications (dedup worked)
      const { data: data2 } = await notificationsService.listWithMedia(userId);
      expect(data2).toHaveLength(1); // Still 1
    });
  });
});
