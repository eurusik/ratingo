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
import { SHOW_STATE_PORT } from '../domain/ports/show-state.port';
import { USER_PREFERENCE_PORT } from '../domain/ports/user-preference.port';
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

  const userId = 'user-123';
  const mediaItemId = 'media-456';

  beforeEach(async () => {
    // Reset stores
    subscriptions.clear();
    notifications.length = 0;
    actions.length = 0;

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
      deactivate: jest
        .fn()
        .mockImplementation(async (uid: string, mid: string, trigger: string) => {
          const key = `${uid}-${mid}-${trigger}`;
          const sub = subscriptions.get(key);
          if (sub?.isActive) {
            sub.isActive = false;
            subscriptions.set(key, sub);
            return true;
          }
          return false;
        }),
      findActiveTriggersForMedia: jest.fn().mockImplementation(async (uid: string, mid: string) => {
        const triggers: string[] = [];
        for (const [, sub] of subscriptions) {
          if (sub.userId === uid && sub.mediaItemId === mid && sub.isActive) {
            triggers.push(sub.trigger);
          }
        }
        return triggers;
      }),
      listActiveWithMedia: jest.fn(),
      countActive: jest.fn(),
      atomicNotifyNewEpisode: jest
        .fn()
        .mockImplementation(async (mid: string, episodeKey: string) => {
          const results: any[] = [];
          for (const [key, sub] of subscriptions) {
            if (
              sub.mediaItemId === mid &&
              sub.isActive &&
              sub.trigger === SUBSCRIPTION_TRIGGER.NEW_EPISODE &&
              sub.lastNotifiedEpisodeKey !== episodeKey
            ) {
              sub.lastNotifiedEpisodeKey = episodeKey;
              subscriptions.set(key, sub);
              results.push({ id: sub.id, userId: sub.userId, mediaItemId: sub.mediaItemId });
            }
          }
          return results;
        }),
      atomicNotifyNewSeason: jest
        .fn()
        .mockImplementation(async (mid: string, seasonNumber: number) => {
          const results: any[] = [];
          for (const [key, sub] of subscriptions) {
            if (
              sub.mediaItemId === mid &&
              sub.isActive &&
              sub.trigger === SUBSCRIPTION_TRIGGER.NEW_SEASON &&
              (sub.lastNotifiedSeasonNumber === null || sub.lastNotifiedSeasonNumber < seasonNumber)
            ) {
              sub.lastNotifiedSeasonNumber = seasonNumber;
              subscriptions.set(key, sub);
              results.push({ id: sub.id, userId: sub.userId, mediaItemId: sub.mediaItemId });
            }
          }
          return results;
        }),
      deactivateForEndedShow: jest.fn().mockResolvedValue(0),
    };

    // Mock show state port (current aired state: S2E10)
    const showStatePort = {
      getLastAiredEpisodeKey: jest.fn().mockResolvedValue('S2E10'),
    };

    // Mock user preference port
    const userPreferencePort = {
      getAutoSubscribeOnWatch: jest.fn().mockResolvedValue(false),
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
      countTotal: jest.fn().mockImplementation(async (uid, unread) => {
        const filtered = notifications.filter((n) => n.userId === uid);
        if (unread === true) return filtered.filter((n) => !n.isRead).length;
        return filtered.length;
      }),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        SubscriptionTriggerService,
        NotificationsService,
        { provide: USER_SUBSCRIPTION_REPOSITORY, useValue: subscriptionRepo },
        { provide: USER_MEDIA_ACTION_REPOSITORY, useValue: actionRepo },
        { provide: USER_NOTIFICATION_REPOSITORY, useValue: notificationRepo },
        { provide: SHOW_STATE_PORT, useValue: showStatePort },
        { provide: USER_PREFERENCE_PORT, useValue: userPreferencePort },
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

  describe('Drop → Restore → Resubscribe cycle', () => {
    it('should receive notifications after drop and restore when auto-subscribe enabled', async () => {
      // Step 1: User subscribes manually
      await subscriptionsService.subscribe({
        userId,
        mediaItemId,
        trigger: SUBSCRIPTION_TRIGGER.NEW_SEASON,
        context: 'show-page',
      });

      // Verify active subscription
      const activeBefore = await subscriptionsService.getActiveTriggersForMedia(
        userId,
        mediaItemId,
      );
      expect(activeBefore).toContain(SUBSCRIPTION_TRIGGER.NEW_SEASON);

      // Step 2: User drops the show → unsubscribe (simulates AutoUnsubscribeOnDropListener)
      const deactivated = await subscriptionsService.unsubscribe(
        userId,
        mediaItemId,
        SUBSCRIPTION_TRIGGER.NEW_SEASON,
        'auto-dropped',
      );
      expect(deactivated).toBe(true);

      // Verify subscription is inactive
      const activeAfterDrop = await subscriptionsService.getActiveTriggersForMedia(
        userId,
        mediaItemId,
      );
      expect(activeAfterDrop).not.toContain(SUBSCRIPTION_TRIGGER.NEW_SEASON);

      // Step 3: Sync while dropped — no notification
      const diff: ShowSyncDiff = {
        tmdbId: 12345,
        mediaItemId,
        hasChanges: true,
        changes: {
          newSeason: { seasonNumber: 3, airDate: '2025-03-01', key: '3' },
        },
      };
      const eventsWhileDropped = await triggerService.handleShowDiff(diff);
      expect(eventsWhileDropped).toHaveLength(0);

      // Step 4: User restores → autoSubscribeForShow (simulates AutoResubscribeOnRestoreListener)
      // Enable auto-subscribe preference for this user
      const userPrefPort = (subscriptionsService as any).userPreferencePort;
      userPrefPort.getAutoSubscribeOnWatch.mockResolvedValue(true);

      await subscriptionsService.autoSubscribeForShow(userId, mediaItemId);

      // Verify resubscribed
      const activeAfterRestore = await subscriptionsService.getActiveTriggersForMedia(
        userId,
        mediaItemId,
      );
      expect(activeAfterRestore).toContain(SUBSCRIPTION_TRIGGER.NEW_SEASON);

      // Step 5: New season sync → notification arrives
      const diff2: ShowSyncDiff = {
        tmdbId: 12345,
        mediaItemId,
        hasChanges: true,
        changes: {
          newSeason: { seasonNumber: 4, airDate: '2025-06-01', key: '4' },
        },
      };
      const eventsAfterRestore = await triggerService.handleShowDiff(diff2);
      expect(eventsAfterRestore).toHaveLength(1);
      expect(eventsAfterRestore[0].payload.seasonNumber).toBe(4);
    });

    it('should NOT resubscribe when auto-subscribe preference is disabled', async () => {
      // Step 1: Subscribe manually, then drop
      await subscriptionsService.subscribe({
        userId,
        mediaItemId,
        trigger: SUBSCRIPTION_TRIGGER.NEW_SEASON,
      });
      await subscriptionsService.unsubscribe(
        userId,
        mediaItemId,
        SUBSCRIPTION_TRIGGER.NEW_SEASON,
        'auto-dropped',
      );

      // Step 2: Restore with auto-subscribe OFF (default mock)
      await subscriptionsService.autoSubscribeForShow(userId, mediaItemId);

      // Verify: Still no active subscription
      const active = await subscriptionsService.getActiveTriggersForMedia(userId, mediaItemId);
      expect(active).not.toContain(SUBSCRIPTION_TRIGGER.NEW_SEASON);
    });
  });
});
