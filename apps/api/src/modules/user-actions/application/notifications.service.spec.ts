import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { USER_NOTIFICATION_REPOSITORY } from '../domain/repositories/user-notification.repository.interface';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationRepo: any;

  beforeEach(async () => {
    notificationRepo = {
      listWithMedia: jest.fn(),
      countUnread: jest.fn(),
      countTotal: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
      createMany: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: USER_NOTIFICATION_REPOSITORY, useValue: notificationRepo },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('listWithMedia', () => {
    it('should return notifications with unread count, total, and hasMore', async () => {
      const mockNotifications = [
        { id: 'n1', isRead: false },
        { id: 'n2', isRead: true },
      ];
      notificationRepo.listWithMedia.mockResolvedValue(mockNotifications);
      notificationRepo.countTotal.mockResolvedValue(5);
      notificationRepo.countUnread.mockResolvedValue(1);

      const result = await service.listWithMedia('user-1');

      expect(result.data).toEqual(mockNotifications);
      expect(result.unreadCount).toBe(1);
      expect(result.total).toBe(5);
      expect(result.hasMore).toBe(true);
    });

    it('should skip countUnread when unread filter is true', async () => {
      const mockNotifications = [{ id: 'n1', isRead: false }];
      notificationRepo.listWithMedia.mockResolvedValue(mockNotifications);
      notificationRepo.countTotal.mockResolvedValue(3);

      const result = await service.listWithMedia('user-1', 20, 0, true);

      expect(notificationRepo.countUnread).not.toHaveBeenCalled();
      expect(result.unreadCount).toBe(3);
      expect(result.total).toBe(3);
    });

    it('should call countUnread when no unread filter', async () => {
      const mockNotifications = [
        { id: 'n1', isRead: false },
        { id: 'n2', isRead: true },
      ];
      notificationRepo.listWithMedia.mockResolvedValue(mockNotifications);
      notificationRepo.countTotal.mockResolvedValue(10);
      notificationRepo.countUnread.mockResolvedValue(4);

      const result = await service.listWithMedia('user-1');

      expect(notificationRepo.countUnread).toHaveBeenCalledWith('user-1');
      expect(result.unreadCount).toBe(4);
      expect(result.total).toBe(10);
    });

    it('should calculate hasMore correctly', async () => {
      // Case 1: offset + data.length < total => hasMore = true
      notificationRepo.listWithMedia.mockResolvedValue([{ id: 'n1' }, { id: 'n2' }]);
      notificationRepo.countTotal.mockResolvedValue(5);
      notificationRepo.countUnread.mockResolvedValue(0);

      const result1 = await service.listWithMedia('user-1', 2, 0);
      expect(result1.hasMore).toBe(true);

      // Case 2: offset + data.length >= total => hasMore = false
      notificationRepo.listWithMedia.mockResolvedValue([{ id: 'n4' }, { id: 'n5' }]);
      notificationRepo.countTotal.mockResolvedValue(5);

      const result2 = await service.listWithMedia('user-1', 2, 3);
      expect(result2.hasMore).toBe(false);

      // Case 3: exact boundary offset + data.length === total => hasMore = false
      notificationRepo.listWithMedia.mockResolvedValue([{ id: 'n3' }, { id: 'n4' }, { id: 'n5' }]);
      notificationRepo.countTotal.mockResolvedValue(5);

      const result3 = await service.listWithMedia('user-1', 3, 2);
      expect(result3.hasMore).toBe(false);
    });

    it('should forward pagination params to repository', async () => {
      notificationRepo.listWithMedia.mockResolvedValue([]);
      notificationRepo.countTotal.mockResolvedValue(0);
      notificationRepo.countUnread.mockResolvedValue(0);

      await service.listWithMedia('user-1', 10, 20, true);

      expect(notificationRepo.listWithMedia).toHaveBeenCalledWith('user-1', 10, 20, true);
      expect(notificationRepo.countTotal).toHaveBeenCalledWith('user-1', true);
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      notificationRepo.markAsRead.mockResolvedValue(true);

      const result = await service.markAsRead('notif-1', 'user-1');

      expect(result).toBe(true);
      expect(notificationRepo.markAsRead).toHaveBeenCalledWith('notif-1', 'user-1');
    });
  });

  describe('markAllAsRead - read semantics invariant', () => {
    it('should mark all current notifications as read', async () => {
      notificationRepo.markAllAsRead.mockResolvedValue(5);

      const count = await service.markAllAsRead('user-1');

      expect(count).toBe(5);
      expect(notificationRepo.markAllAsRead).toHaveBeenCalledWith('user-1');
    });

    it('should return 0 when no unread notifications', async () => {
      notificationRepo.markAllAsRead.mockResolvedValue(0);

      const count = await service.markAllAsRead('user-1');

      expect(count).toBe(0);
    });
  });

  describe('createFromEvents', () => {
    it('should create notifications from events', async () => {
      notificationRepo.createMany.mockResolvedValue(3);

      const events = [
        { userId: 'u1', mediaItemId: 'm1', subscriptionId: 's1', trigger: 'new_season' as const },
        { userId: 'u2', mediaItemId: 'm1', subscriptionId: 's2', trigger: 'new_season' as const },
        { userId: 'u3', mediaItemId: 'm1', subscriptionId: 's3', trigger: 'new_season' as const },
      ];

      const count = await service.createFromEvents(events);

      expect(count).toBe(3);
      expect(notificationRepo.createMany).toHaveBeenCalledWith(events);
    });

    it('should return 0 for empty events array', async () => {
      const count = await service.createFromEvents([]);

      expect(count).toBe(0);
      expect(notificationRepo.createMany).not.toHaveBeenCalled();
    });
  });
});
