import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from '../../application/notifications.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let notificationsService: any;

  const mockUser = { id: 'user-123' };

  const mockNotification = {
    id: 'notif-1',
    trigger: 'new_season',
    payload: { seasonNumber: 3 },
    isRead: false,
    createdAt: new Date('2025-01-15T10:00:00Z'),
    mediaSummary: {
      id: 'media-1',
      type: 'show',
      title: 'Breaking Bad',
      slug: 'breaking-bad',
      poster: null,
    },
  };

  beforeEach(async () => {
    notificationsService = {
      listWithMedia: jest.fn(),
      getUnreadCount: jest.fn(),
      markAsRead: jest.fn(),
      markAllAsRead: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: notificationsService }],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
  });

  describe('list', () => {
    it('should return notifications with unread count, total, and hasMore', async () => {
      notificationsService.listWithMedia.mockResolvedValue({
        data: [mockNotification],
        unreadCount: 1,
        total: 5,
        hasMore: true,
      });

      const result = await controller.list(mockUser, { limit: 10, offset: 0 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('notif-1');
      expect(result.data[0].trigger).toBe('new_season');
      expect(result.data[0].createdAt).toBe('2025-01-15T10:00:00.000Z');
      expect(result.unreadCount).toBe(1);
      expect(result.total).toBe(5);
      expect(result.hasMore).toBe(true);
      expect(notificationsService.listWithMedia).toHaveBeenCalledWith('user-123', 10, 0, undefined);
    });

    it('should pass unread filter to service', async () => {
      notificationsService.listWithMedia.mockResolvedValue({
        data: [],
        unreadCount: 0,
        total: 0,
        hasMore: false,
      });

      await controller.list(mockUser, { limit: 20, offset: 0, unread: true });

      expect(notificationsService.listWithMedia).toHaveBeenCalledWith('user-123', 20, 0, true);
    });

    it('should use default pagination when not provided', async () => {
      notificationsService.listWithMedia.mockResolvedValue({
        data: [],
        unreadCount: 0,
        total: 0,
        hasMore: false,
      });

      await controller.list(mockUser, {});

      expect(notificationsService.listWithMedia).toHaveBeenCalledWith(
        'user-123',
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      notificationsService.getUnreadCount.mockResolvedValue(5);

      const result = await controller.getUnreadCount(mockUser);

      expect(result.unreadCount).toBe(5);
      expect(notificationsService.getUnreadCount).toHaveBeenCalledWith('user-123');
    });
  });

  describe('markAsRead', () => {
    it('should mark notification as read', async () => {
      notificationsService.markAsRead.mockResolvedValue(true);

      const result = await controller.markAsRead(mockUser, 'notif-1');

      expect(result.success).toBe(true);
      expect(notificationsService.markAsRead).toHaveBeenCalledWith('notif-1', 'user-123');
    });

    it('should return false when notification not found', async () => {
      notificationsService.markAsRead.mockResolvedValue(false);

      const result = await controller.markAsRead(mockUser, 'notif-999');

      expect(result.success).toBe(false);
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      notificationsService.markAllAsRead.mockResolvedValue(3);

      const result = await controller.markAllAsRead(mockUser);

      expect(result.success).toBe(true);
      expect(result.count).toBe(3);
      expect(notificationsService.markAllAsRead).toHaveBeenCalledWith('user-123');
    });
  });
});
