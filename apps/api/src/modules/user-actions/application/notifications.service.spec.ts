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
    it('should return notifications with unread count', async () => {
      const mockNotifications = [
        { id: 'n1', isRead: false },
        { id: 'n2', isRead: true },
      ];
      notificationRepo.listWithMedia.mockResolvedValue(mockNotifications);
      notificationRepo.countUnread.mockResolvedValue(1);

      const result = await service.listWithMedia('user-1');

      expect(result.data).toEqual(mockNotifications);
      expect(result.unreadCount).toBe(1);
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
